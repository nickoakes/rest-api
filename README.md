# REST API Project

A REST API for an application that enables users to create, read, update and delete course listings. Built using Express and Sequelize. 

Users can only create, update and delete courses after creating an account and logging in. Authorisation also ensures that users are only permitted to update and delete courses for which they have permission to do so.

When a new user is created, their password is hashed using Bcrypt.js before being added to the database.

Validation is used to ensure that a new course or user may only be be created, and a course updated, if all of the required fields have been supplied.

Written to meet 'Exceeds Expectations' standard.
