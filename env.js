'use strict'

// Initialize environmental variables
const env = require('dotenv').config()

/**
 * Retrieve the value of an environmental variable, or set the value if a value
 * is provided.
 *
 * @param  {string} name    The name of the variable to retrieve.
 * @param  {*}      [value] A value to set for the variable.
 * @return {*}
 */
module.exports = function (name, value) {
  if (typeof value === 'undefined') {
    return process.env[name]
  }

  process.env[name] = value
}