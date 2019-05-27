'use strict';

// load modules
const express = require('express');
const morgan = require('morgan');
const Sequelize = require('sequelize');
const { check, validationResult, isEmail } = require('express-validator/check');
const bcryptjs = require('bcryptjs');
const auth = require('basic-auth');
var bodyParser = require('body-parser');

var User = require('./models').User;
var Course = require('./models').Course;

// initialize new instance of sequelize class

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: './fsjstd-restapi.db'
});

// test connection to database

sequelize
  .authenticate()
  .then(() => {
    console.log('Connection has been established successfully.');
  })
  .catch(err => {
    console.error('Unable to connect to the database:', err);
  });

// variable to enable global error logging
const enableGlobalErrorLogging = process.env.ENABLE_GLOBAL_ERROR_LOGGING === 'true';

// create the Express app
const app = express();

// setup morgan which gives us http request logging
app.use(morgan('dev'));

// setup body-parser

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// authenticate users

const authenticateUser = (req, res, next) => {
  let message = null;
  const credentials = auth(req);

  if(credentials) {
    User.findAll({where: {emailAddress: credentials.name}})
    .then(function(user) {
      let currentUser = user[0].dataValues;
      console.log(currentUser);
      if(user) {
        const authenticated = bcryptjs
        .compareSync(credentials.pass, currentUser.password);
      if (authenticated) {
        console.log(`Authentication successful for user with email address: ${currentUser.emailAddress}`);
        req.currentUser = currentUser;
        next();
      } else {
        message = `Authentication unsuccessful for user with email address ${currentUser.emailAddress}`;
      }
    } else {
      message = `No user was found with email address ${currentUser.emailAddress}`;
    }
  });
  } else {
    message = 'Authentication header not found';
  }
  if(message) {
    console.warn(message);
    res.status(401).json({message: 'Access denied'});
  }
};

// TODO setup your api routes here

// get current authenticated user

app.get('/api/users', authenticateUser, (req, res) => {
  res.json({
    id: req.currentUser.id,
    name: req.currentUser.firstName + ' ' + req.currentUser.lastName,
    username: req.currentUser.emailAddress,
  });
});

// create new user

app.post('/api/users', [
  check('firstName')
    .exists({checkNull: true, checkFalsy: true})
    .withMessage('Please enter your first name'),
  check('lastName')
    .exists({checkNull: true, checkFalsy: true})
    .withMessage('Please enter your last name'),
  check('emailAddress')
    .exists({checkNull: true, checkFalsy: true})
    .withMessage('Please enter your email address')
    .isEmail()
    .withMessage('Please ensure the email address entered is valid')
    .custom((value, {req}) => {
      if(value) {
        return User.findAll({where: {emailAddress: value}})
        .then((user) => {
          if(user.length) {
            console.log(user.length);
            return Promise.reject();
          }
        });
      } else {
        return true;
      }
    })
    .withMessage('Sorry, a user with that email address already exists'),
  check('password')
    .exists({checkNull: true, checkFalsy: true})
    .withMessage('Please enter a password')
], (req, res) => {
  
  const errors = validationResult(req);

  if(!errors.isEmpty()) {
    const errorMessages = errors.array().map(error => error.msg);

    return res.status(400).json(({errors: errorMessages}));
  }

  const user = req.body;

  user.password = bcryptjs.hashSync(user.password);

  User.create(user);
  
  res.status(201).location('/').end();
});

// show course list

app.get('/api/courses', (req, res) => {
  Course.findAll({attributes: {exclude: ['createdAt', 'updatedAt']}}).then(function(courses) {
    res.json(courses);
  });
});

// show course by id

app.get('/api/courses/:id', (req, res) => {
  Course.findAll({where: {id: req.params.id}})
  .then(function(course){
    if(course.length) {
      res.json(course);
    } else {
      res.status(404).json({message: 'No courses found'}).end();
    }
  });
});

// add new course

app.post('/api/courses', authenticateUser, [
  check('title')
    .exists({checkNull: true, checkFalsy: true})
    .withMessage('Please enter a course title'),
  check('description')
    .exists({checkNull: true, checkFalsy: true})
    .withMessage('Please enter a course description')
], (req, res) => {

  const errors = validationResult(req);

  if(!errors.isEmpty()) {
    const errorMessages = errors.array().map(error => error.msg);

    return res.status(400).json(({errors: errorMessages}));
  }

  Course.create(req.body).then(function(course) {
    res.status(201).location('/api/courses/' + course.dataValues.id).end();
  });
});

// update existing course

app.put('/api/courses/:id', authenticateUser, [
  check('title')
    .exists({checkNull: true, checkFalsy: true})
    .withMessage('Please enter a course title'),
  check('description')
    .exists({checkNull: true, checkFalsy: true})
    .withMessage('Please enter a course description'),
  check('userId')
    .custom((value, {req}) => {
      if(value) {
        if(req.currentUser.id === value) {
          return true;
        } else {
          return false;
        }
      } else {
        return true;
      }
    })
    .withMessage('Sorry, you are not authorised to edit this course')
], (req, res) => {
  const errors = validationResult(req);

  if(!errors.isEmpty()) {
    const errorMessages = errors.array().map(error => error.msg);

    if(errorMessages[0] === 'Sorry, you are not authorised to edit this course') {
      return res.status(403).json(({errors: errorMessages}));
    } else {
      return res.status(400).json(({errors: errorMessages}));
    }
  }
  Course.update(req.body, {where: {id: req.params.id}})
  .then(function(course) {
    res.status(204).location('/api/courses' + course).end();
  });
});

// delete a course

app.delete('/api/courses/:id', authenticateUser, [
  check('userId')
    .custom((value, {req}) => {
      console.log(value);
      console.log(req.currentUser.id);
      if(req.currentUser.id === value) {
        return true;
      } else {
        return false;
      }
    })
    .withMessage('Sorry, you are not authorised to delete this course')
], (req, res) => {
  const errors = validationResult(req);

  if(!errors.isEmpty()) {
    const errorMessages = errors.array().map(error => error.msg);

    return res.status(403).json(({errors: errorMessages}));
  }

  Course.destroy({where: {id: req.params.id}})
  .then(res.status(204));
});

// setup a friendly greeting for the root route
app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to the REST API project!',
  });
});

// send 404 if no other route matched
app.use((req, res) => {
  res.status(404).json({
    message: 'Route Not Found',
  });
});

// setup a global error handler
app.use((err, req, res, next) => {
  if (enableGlobalErrorLogging) {
    console.error(`Global error handler: ${JSON.stringify(err.stack)}`);
  }

  res.status(err.status || 500).json({
    message: err.message,
    error: {},
  });
});

// set our port
app.set('port', process.env.PORT || 5000);

// start listening on our port
const server = app.listen(app.get('port'), () => {
  console.log(`Express server is listening on port ${server.address().port}`);
});
