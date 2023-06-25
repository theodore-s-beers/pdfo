// This library was forked from Philip Hutchison's PDFObject. His license is
// below. A substantial, and growing, number of changes has been made---not
// least the conversion to TypeScript.

/*!
 *  PDFObject v2.2.7
 *  https://github.com/pipwerks/PDFObject
 *  @license
 *  Copyright (c) 2008–2021 Philip Hutchison
 *  MIT-style license: https://pipwerks.mit-license.org/
 */

//
// TYPES
//

interface EmbedOptions {
  assumeSupport?: boolean
  fallbackLink?: string
  fallbackPrefix?: string
  height?: string
  omitInlineStyles?: boolean
  pdfOpenParams?: Record<string, unknown>
  width?: string
}

//
// GLOBAL VARIABLES
//

// Shorthand variables for Navigator object and UA string
const nav = window.navigator
const ua = nav.userAgent

// A recent, and still Chromium-only, way of checking for a mobile browser
const newMobileTest = nav.userAgentData?.mobile

// Safari on iPadOS doesn't report as "mobile" when requesting a desktop site,
// yet still fails to embed PDFs.
const isSafariIPadOS =
  /Macintosh/i.test(ua) && nav.maxTouchPoints && nav.maxTouchPoints > 1

// Our best guess as to whether we're dealing with a mobile device
const isMobileDevice =
  newMobileTest === true ||
  /Mobi|Tablet|Android|iPad|iPhone/.test(ua) ||
  isSafariIPadOS

//
// PUBLIC FUNCTIONS
//

export function embed (
  url: string,
  targetSelector?: string,
  options?: EmbedOptions
): void {
  // Ensure options not undefined -- enables easier error checking below
  const opt = options || {}

  // Get passed options, or set reasonable defaults
  const pdfOpenParams = opt.pdfOpenParams || {}
  const width = opt.width || '100%'
  const height = opt.height || '100%'
  const assumeSupport = opt.assumeSupport !== false // true unless explicitly false
  const omitInlineStyles = opt.omitInlineStyles === true // false unless explicitly true

  // Fallback options require special handling
  const fallbackLink =
    typeof opt.fallbackLink === 'string'
      ? opt.fallbackLink
      : "<p>This browser does not support inline PDFs. Please download the file to view it: <a href='[url]'>Download PDF</a></p>"
  const fallbackPrefix = opt.fallbackPrefix || ''

  const selector = targetSelector || ''
  const targetNode = getTargetElement(selector)

  // If target element is specified but not valid, exit without doing anything
  // How would targetNode be falsy? I don't yet understand this
  if (!targetNode) {
    return embedError('Target element cannot be determined')
  }

  // Stringify optional Adobe params for opening PDF (as fragment identifier)
  const pdfOpenFragment = buildURLFragmentString(pdfOpenParams)

  // --== Attempt embed ==--

  // Embed PDF if traditional support is provided, or if this developer is
  // willing to roll with assumption that modern desktop (not mobile) browsers
  // natively support PDFs
  if (supportsPDFs() || (assumeSupport && !isMobileDevice)) {
    // Historically, the PDFObject library used <embed> elements by default,
    // while providing the option of using <iframe> instead. Over time, it
    // became increasingly common for browsers to have trouble with <embed>. I
    // think we are on a trajectory to where <embed> will be effectively a
    // deprecated element. <iframe> can do everything that <embed> can do, and
    // it sees much, much more use. My choice for the pdfo fork of PDFObject,
    // until further notice, is to use only <iframe>. This allows for some
    // simplification of both the API and library logic. If there are indeed
    // users who prefer <embed>, the change can be reversed.
    const embedType = 'iframe'

    return generatePDFoMarkup(
      embedType,
      targetNode,
      url,
      pdfOpenFragment,
      width,
      height,
      omitInlineStyles
    )
  }

  // --== PDF embed not supported! Use fallback ==--

  if (fallbackPrefix) {
    const embedType = 'fallback'

    return generatePDFoMarkup(
      embedType,
      targetNode,
      fallbackPrefix + url,
      pdfOpenFragment,
      width,
      height,
      omitInlineStyles
    )
  }

  // Last resort: display fallback link (if available) and return an error
  if (fallbackLink) {
    targetNode.innerHTML = fallbackLink.replace(/\[url\]/, url)
  }

  return embedError('This browser does not support embedded PDFs')
}

export function supportsPDFs (): boolean {
  // New property available in recent versions of Chrome and Firefox. If it
  // comes back true or false, go with it
  if (typeof nav.pdfViewerEnabled === 'boolean') {
    return nav.pdfViewerEnabled
  }

  /*
    There is a coincidental correlation between implementation of promises and 
    native PDF support in desktop browsers.
    We assume that if the browser supports promises it supports embedded PDFs.
    Is this fragile? Sort of. But browser vendors removed mimetype detection, 
    so we're left to improvise.
  */
  const isModernBrowser = typeof Promise !== 'undefined'

  return isModernBrowser && !isMobileDevice
}

//
// PRIVATE FUNCTIONS (alphabetical)
//

function buildURLFragmentString (pdfParams: Record<string, unknown>): string {
  let string = ''

  if (pdfParams) {
    for (const prop in pdfParams) {
      if (Object.prototype.hasOwnProperty.call(pdfParams, prop)) {
        string += `${encodeURIComponent(prop)}=${encodeURIComponent(
          String(pdfParams[prop])
        )}&`
      }
    }

    // The string will be empty if no PDF Params found
    if (string) {
      string = `#${string}`

      // Remove last ampersand
      string = string.slice(0, string.length - 1)
    }
  }

  return string
}

function embedError (msg: string): void {
  console.log(`[pdfo] ${msg}`)
}

function emptyNodeContents (node: HTMLElement): void {
  while (node.firstChild) {
    node.removeChild(node.firstChild)
  }
}

function generatePDFoMarkup (
  embedType: string,
  targetNode: HTMLElement,
  url: string,
  pdfOpenFragment: string,
  width: string,
  height: string,
  omitInlineStyles: boolean
): void {
  // Ensure target element is empty first
  emptyNodeContents(targetNode)

  const embed = document.createElement('iframe')
  embed.allow = 'fullscreen'

  embed.src = embedType === 'fallback' ? url : url + pdfOpenFragment
  embed.className = 'pdfo'

  if (!omitInlineStyles) {
    let style = 'border: none;'

    if (targetNode === document.body) {
      style +=
        'position: absolute; top: 0; right: 0; bottom: 0; left: 0; width: 100%; height: 100%;'
    } else {
      style += `width: ${width}; height: ${height};`
    }

    embed.style.cssText = style
  }

  targetNode.classList.add('pdfo-container')

  // This is where the magic finally happens
  targetNode.appendChild(embed)
}

function getTargetElement (targetSelector: string): HTMLElement {
  let targetNode: HTMLElement

  if (targetSelector) {
    targetNode = document.querySelector(targetSelector) || document.body
  } else {
    targetNode = document.body
  }

  return targetNode
}
