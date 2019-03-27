'use strict'

const urlJoin = require('url-join')

const networkService = require('./networkService')
const env = require('../env')
const http = require('../utilities/http')

const baseURL = env('BASE_URL')
const contentURL = urlJoin(baseURL, '/content')

module.exports = {
  getContent (userId, intent) {
    let body = {
        "userId":userId,
        "intent":intent
    }
    return networkService.sendRequest(http.GET, contentURL, undefined, undefined, body, undefined)
  }
}