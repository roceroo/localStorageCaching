const cache = require('./src/cache')

let ttl = localStorage.getItem('/ttl')
if (!ttl) {
  ttl = new Date()
  ttl.setMinutes(ttl.getMinutes() + 15) // default ttl of fifteen minutes
  localStorage.setItem('/ttl', ttl)
} else {
  ttl = new Date(ttl)
}

/*
  cachedUrls = [
    {
      url: 'api.myapi/graphics,
      queryParams: ['exQuery'],
      bodyParams: ['exBody'],
    },
    {
      url: 'api.myapi/info'
    },
    'api.myapi/superinfo'
  ]
*/

module.exports = function (axios, cachedUrls) {
  if (!axios) {
    throw new ReferenceError('You must pass axios or axios instance')
  }

  if (!cachedUrls) {
    throw new ReferenceError('c\'mon, man')
  }

  if (!Array.isArray(cachedUrls)) {
    throw new TypeError('the cached urls must be an array')
  }

  if (cachedUrls.some(elem => {
    if (!elem) {
      return true
    }

    if (Array.isArray(elem)) {
      return true
    }

    if (typeof elem === 'object') {
      if (!elem.url) {
        return true
      }
    } else if (typeof elem !== 'string') {
      return true
    }
  })) {
    throw new TypeError('Please, provide only objects (with a url) or a string')
  }

  return {
    async get (url, config) {
      await this.checkTtl() // At the request's beggining check if the ttl is still available

      let cacheable = false

      cachedUrls.forEach(elem => {
        if (typeof elem === 'string') {
          if (url.includes(elem)) {
            cacheable = elem        
          }
        } else {
          if (url.includes(elem.url)) {
            cacheable = elem
          }
        }
      })

      if (cacheable) {
        let cached = null
        const queryKeys = {}

        if (typeof cacheable === 'string') {
          cached = cache.get(cacheable)
        } else {

          if (cacheable.queryParams) {
            if (Array.isArray(cacheable.queryParams) && config) {
              cacheable.queryParams.forEach(elem => {
                queryKeys[elem] = config.params[elem]
              })
            } else if (config) {
              throw new TypeError('QueryParams must be an array')
            }
          }
          if (Object.keys(queryKeys).length > 0) {
            cached = cache.get(url, config, queryKeys)
          } else {
            cached = cache.get(cacheable)
          }
        }

        if (cached) {
          return Promise.resolve({
            data: JSON.parse(cached),
            status: 200,
            statusText: 'OK, cached',
            headers: {},
            request: {}
          })
        } else {
          const response = await axios.get(url, config)
          if (Object.keys(queryKeys).length > 0) {
            cache.set(response, queryKeys, url)
          } else {
            cache.set(response)
          }
          return response
        }
      }
      return axios.get(url, config)
    },

    setTtl (ttlParam = new Date()) {
      ttl = ttlParam
      localStorage.setItem('/ttl', ttl)
    },

    checkTtl () {
      const now = new Date()
      if (now.getTime() >= ttl.getTime()) {
        resetKeys()
      }
    },

    resetKeys () {
      const localStorageKeys = Object.keys(window.localStorage)
      localStorageKeys.forEach(item => {
        if (item[0] === '/') {
          localStorage.removeItem(item)
        }
      })
    }
  }
}
