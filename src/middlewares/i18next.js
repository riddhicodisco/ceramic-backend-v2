const i18next = require('i18next')
const FsBackend = require('i18next-fs-backend')
const middleware = require('i18next-http-middleware')
const path = require('path')

i18next
    .use(middleware.LanguageDetector)
    .use(FsBackend)
    .init({
        lng: 'lng',
        fallbackLng: 'en',
        supportedLngs: ['en', 'gu', 'hi'],
        preload: ['en', 'gu', 'hi'],
        saveMissing: true,
        debug: false,
        ns: ['validation', 'attributes'],
        defaultNS: 'attributes',
        backend: {
            loadPath: path.resolve(
                __dirname + '/../../i18n/{{lng}}/{{ns}}.json'
            ),
            addPath: path.resolve(
                __dirname + '/../../i18n/{{lng}}/{{ns}}.missing.json'
            ),
        },
        detection: {
            order: ['header', 'cookie'],
            caches: ['cookie'],
            lookupHeader: 'accept-language',
            cookieMinutes: 160,
            lookupQuerystring: 'lng',
            lookupFromPathIndex: 0,
        },
    })

const i18nextMiddleware = middleware.handle(i18next)
module.exports = i18nextMiddleware
