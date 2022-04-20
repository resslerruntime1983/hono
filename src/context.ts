import { getStatusText } from '@/utils/http-status'
import type { StatusCode } from '@/utils/http-status'
import { isAbsoluteURL } from '@/utils/url'

type Headers = Record<string, string>
type Data = string | ArrayBuffer | ReadableStream

export interface Env {}

export class Context<RequestParamKeyType = string> {
  req: Request<RequestParamKeyType>
  res: Response
  env: Env
  event: FetchEvent
  private _headers: Headers
  private _status: StatusCode
  private _statusText: string
  private _pretty: boolean
  private _prettySpace: number = 2

  render: (template: string, params?: object, options?: object) => Promise<Response>
  notFound: () => Response | Promise<Response>

  constructor(
    req: Request<RequestParamKeyType>,
    opts?: { res: Response; env: Env; event: FetchEvent }
  ) {
    this.req = req
    if (opts) {
      this.res = opts.res
      this.env = opts.env
      this.event = opts.event
    }
    this._headers = {}
  }

  header(name: string, value: string): void {
    /*
    XXX:
    app.use('*', (c, next) => {
      next()
      c.header('foo', 'bar') // => c.res.headers.set(...)
    })
    */
    if (this.res) {
      this.res.headers.set(name, value)
    }
    this._headers[name] = value
  }

  status(status: StatusCode): void {
    if (this.res) {
      console.warn('c.res.status is already set.')
      return
    }
    this._status = status
    this._statusText = getStatusText(status)
  }

  pretty(prettyJSON: boolean, space: number = 2): void {
    this._pretty = prettyJSON
    this._prettySpace = space
  }

  newResponse(data: Data, init: ResponseInit = {}): Response {
    init.status = init.status || this._status || 200
    init.statusText =
      init.statusText || this._statusText || getStatusText(init.status as StatusCode)

    init.headers = { ...this._headers, ...init.headers }

    // Content-Length
    let length = 0
    if (data) {
      if (data instanceof ArrayBuffer) {
        length = data.byteLength
      } else if (typeof data == 'string') {
        const Encoder = new TextEncoder()
        length = Encoder.encode(data).byteLength || 0
      }
    }
    init.headers = { ...init.headers, ...{ 'Content-Length': length.toString() } }

    return new Response(data, init)
  }

  body(data: Data, status: StatusCode = this._status, headers: Headers = this._headers): Response {
    return this.newResponse(data, {
      status: status,
      headers: headers,
    })
  }

  text(text: string, status: StatusCode = this._status, headers: Headers = {}): Response {
    if (typeof text !== 'string') {
      throw new TypeError('text method arg must be a string!')
    }
    headers['Content-Type'] ||= 'text/plain; charset=UTF-8'
    return this.body(text, status, headers)
  }

  json(object: object, status: StatusCode = this._status, headers: Headers = {}): Response {
    if (typeof object !== 'object') {
      throw new TypeError('json method arg must be a object!')
    }
    const body = this._pretty
      ? JSON.stringify(object, null, this._prettySpace)
      : JSON.stringify(object)
    headers['Content-Type'] ||= 'application/json; charset=UTF-8'
    return this.body(body, status, headers)
  }

  html(html: string, status: StatusCode = this._status, headers: Headers = {}): Response {
    if (typeof html !== 'string') {
      throw new TypeError('html method arg must be a string!')
    }
    headers['Content-Type'] ||= 'text/html; charset=UTF-8'
    return this.body(html, status, headers)
  }

  redirect(location: string, status: StatusCode = 302): Response {
    if (typeof location !== 'string') {
      throw new TypeError('location must be a string!')
    }
    if (!isAbsoluteURL(location)) {
      const url = new URL(this.req.url)
      url.pathname = location
      location = url.toString()
    }
    return this.newResponse(null, {
      status: status,
      headers: {
        Location: location,
      },
    })
  }
}
