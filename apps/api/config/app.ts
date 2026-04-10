import env from '#start/env'

const appConfig = {
  appKey: env.get('APP_KEY'),
  http: {
    generateRequestId: true,
    allowMethodSpoofing: false,
    trustProxy: false,
    cookie: {
      domain: '',
      path: '/',
      maxAge: '2h',
      httpOnly: true,
      secure: false,
      sameSite: 'lax' as const,
    },
    qs: {
      parse: {
        depth: 5,
        parameterLimit: 1000,
        allowSparse: false,
        arrayLimit: 20,
        comma: false,
      },
      stringify: {
        encode: true,
        encodeValuesOnly: false,
        arrayFormat: 'indices' as const,
        skipNulls: false,
      },
    },
  },
}

export default appConfig
