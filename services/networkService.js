const request = require('request-promise')
const http = require('../utilities/http')

module.exports = {
  /**
   * Sends any network request to external services
   * @param {string} method - A specific HTTP Method (GET, POST, PUT, DELETE)
   * @param {string} uri - The uri to which the request applies
   * @param {object[]} [headers] - The headers to be sent in the network request
   * @param {object[]} [query] - The query parameters to be sent in the network request
   * @param {object[]} [body] - The body to be sent in the network request
   * @param {object[]} [formData] - The form input to be sent in the network request
   */
  sendRequest (method, uri, headers, query, body, formData) {
    let options = {
      method: method,
      headers: headers,
      uri: uri,
      query: query,
      json: true
    }

    if (method !== http.GET) {
      options['body'] = body
      options['form'] = formData
    }

    return request(options).promise()
  }
}