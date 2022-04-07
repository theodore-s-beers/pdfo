/*!
 *  PDFObject v2.2.7
 *  https://github.com/pipwerks/PDFObject
 *  @license
 *  Copyright (c) 2008–2021 Philip Hutchison
 *  MIT-style license: https://pipwerks.mit-license.org/
 */

declare global {
  interface Navigator {
    pdfViewerEnabled?: boolean
  }
}

interface EmbedOptions {
  id?: string
  page?: number | string
  pdfOpenParams?: Record<string, unknown>
  fallbackLink?: string | boolean
  width?: string
  height?: string
  title?: string
  assumptionMode?: boolean
  supportRedirect?: boolean
  omitInlineStyles?: boolean
  forceIframe?: boolean
}

export function embed (
  url: string,
  targetSelector: HTMLElement | string,
  options?: EmbedOptions
): void {
  // Ensure options not undefined -- enables easier error checking below
  const opt = options || {}

  // Get passed options, or set reasonable defaults
  const id = typeof opt.id === 'string' ? opt.id : ''
  const page = opt.page || null
  const pdfOpenParams = opt.pdfOpenParams || {}
  const fallbackLink =
    typeof opt.fallbackLink === 'string' ||
    typeof opt.fallbackLink === 'boolean'
      ? opt.fallbackLink
      : true
  const width = opt.width || '100%'
  const height = opt.height || '100%'
  const title = opt.title || 'Embedded PDF'
  const assumptionMode =
    typeof opt.assumptionMode === 'boolean' ? opt.assumptionMode : true
  const supportRedirect =
    typeof opt.supportRedirect === 'boolean' ? opt.supportRedirect : false
  const omitInlineStyles =
    typeof opt.omitInlineStyles === 'boolean' ? opt.omitInlineStyles : false
  const forceIframe =
    typeof opt.forceIframe === 'boolean' ? opt.forceIframe : false

  const targetNode = getTargetElement(targetSelector)

  const fallbackHTMLDefault =
    "<p>This browser does not support inline PDFs. Please download the PDF to view it: <a href='[url]'>Download PDF</a></p>"

  let fallbackHTML = ''
  let pdfOpenFragment = ''

  // If target element is specified but not valid, exit without doing anything
  // How would targetNode be falsy? I don't yet understand this
  if (!targetNode) {
    return embedError('Target element cannot be determined')
  }

  // page option overrides pdfOpenParams, if found
  if (page) {
    pdfOpenParams.page = page
  }

  // Stringify optional Adobe params for opening PDF (as fragment identifier)
  pdfOpenFragment = buildURLFragmentString(pdfOpenParams)

  // --== Attempt embed ==--

  // Embed PDF if traditional support is provided, or if this developer is
  // willing to roll with assumption that modern desktop (not mobile) browsers
  // natively support PDFs
  if (supportsPDFs() || (assumptionMode && !isMobileDevice())) {
    // Should we use <embed> or <iframe>? In most cases <embed>.
    // Allow developer to force <iframe>, if desired
    // There is an edge case where Safari does not respect 302 redirect requests
    // for PDF files when using <embed> element. Redirect appears to work fine
    // when using <iframe> instead of <embed> (Addresses issue #210). Forcing
    // Safari desktop to use iframe due to freezing bug in macOS 11 (Big Sur)
    const embedType =
      forceIframe || supportRedirect || isSafariDesktop() ? 'iframe' : 'embed'

    return generatePDFoMarkup(
      embedType,
      targetNode,
      targetSelector,
      url,
      pdfOpenFragment,
      width,
      height,
      id,
      title,
      omitInlineStyles
    )
  }

  // --== PDF embed not supported! Use fallback ==--

  // Display the fallback link if available
  if (fallbackLink) {
    fallbackHTML =
      typeof fallbackLink === 'string' ? fallbackLink : fallbackHTMLDefault
    targetNode.innerHTML = fallbackHTML.replace(/\[url\]/g, url)
  }

  return embedError('This browser does not support embedded PDFs')
}

function generatePDFoMarkup (
  embedType: string,
  targetNode: HTMLElement,
  targetSelector: HTMLElement | string,
  url: string,
  pdfOpenFragment: string,
  width: string,
  height: string,
  id: string,
  title: string,
  omitInlineStyles: boolean
): void {
  // Ensure target element is empty first
  emptyNodeContents(targetNode)

  let embed: HTMLEmbedElement | HTMLIFrameElement

  if (embedType === 'iframe') {
    embed = document.createElement(embedType) as HTMLIFrameElement
    embed.allow = 'fullscreen'
  } else {
    embed = document.createElement(embedType) as HTMLEmbedElement
    embed.type = 'application/pdf'
  }

  embed.src = url + pdfOpenFragment
  embed.className = 'pdfo'
  embed.title = title
  embed.id = id

  if (!omitInlineStyles) {
    let style = embedType === 'embed' ? 'overflow: auto;' : 'border: none;'

    if (targetSelector !== document.body) {
      style += 'width: ' + width + '; height: ' + height + ';'
    } else {
      style +=
        'position: absolute; top: 0; right: 0; bottom: 0; left: 0; width: 100%; height: 100%;'
    }

    embed.style.cssText = style
  }

  targetNode.classList.add('pdfo-container')

  // This is where the magic finally happens
  targetNode.appendChild(embed)
}

function getTargetElement (targetSelector: HTMLElement | string): HTMLElement {
  // Default to body for full-browser PDF
  let targetNode = document.body

  // If a targetSelector is specified, check to see whether it's passing a
  // selector or an HTML element

  if (typeof targetSelector === 'string') {
    // Is CSS selector
    targetNode = document.querySelector(targetSelector) as HTMLElement
  } else if (
    targetSelector.nodeType !== undefined &&
    targetSelector.nodeType === 1
  ) {
    // Is HTML element
    targetNode = targetSelector
  }

  return targetNode
}

function embedError (msg: string): void {
  console.log('[pdfo] ' + msg)
}

function emptyNodeContents (node: HTMLElement): void {
  while (node.firstChild) {
    node.removeChild(node.firstChild)
  }
}

function buildURLFragmentString (pdfParams: Record<string, unknown>): string {
  let string = ''

  if (pdfParams) {
    for (const prop in pdfParams) {
      if (Object.prototype.hasOwnProperty.call(pdfParams, prop)) {
        string +=
          encodeURIComponent(prop) +
          '=' +
          encodeURIComponent(String(pdfParams[prop])) +
          '&'
      }
    }

    // The string will be empty if no PDF Params found
    if (string) {
      string = '#' + string

      // Remove last ampersand
      string = string.slice(0, string.length - 1)
    }
  }

  return string
}

export function supportsPDFs (): boolean {
  // New property available in recent versions of Chrome and Firefox
  const pdfViewerEnabled = navigator.pdfViewerEnabled

  // If this comes back true or false, best to just go with it?
  if (typeof pdfViewerEnabled === 'boolean') {
    return pdfViewerEnabled
  }

  /*
    There is a coincidental correlation between implementation of promises and 
    native PDF support in desktop browsers.
    We assume that if the browser supports promises it supports embedded PDFs.
    Is this fragile? Sort of. But browser vendors removed mimetype detection, 
    so we're left to improvise
  */
  const isModernBrowser = typeof Promise !== 'undefined'

  // We're moving into the age of MIME-less browsers.
  // They mostly all support PDF rendering without plugins.
  const likelySupportsPDFs = !isMobileDevice() && isModernBrowser

  return likelySupportsPDFs
}

function isMobileDevice (): boolean {
  const nav = window.navigator
  const ua = window.navigator.userAgent

  // Safari on iPadOS doesn't report as 'mobile' when requesting desktop site,
  // yet still fails to embed PDFs
  const isSafariIOSDesktopMode =
    nav.platform !== undefined &&
    nav.platform === 'MacIntel' &&
    nav.maxTouchPoints !== undefined &&
    nav.maxTouchPoints > 1

  // This is recent, and still Chromium-only
  const newMobileTest = nav.userAgentData?.mobile

  return (
    isSafariIOSDesktopMode ||
    /Mobi|Tablet|Android|iPad|iPhone/.test(ua) ||
    newMobileTest === true
  )
}

// Safari desktop requires special handling (i.e., always use iframe)
function isSafariDesktop (): boolean {
  const nav = window.navigator
  const ua = window.navigator.userAgent

  return (
    !isMobileDevice() &&
    nav.vendor !== undefined &&
    /Apple/.test(nav.vendor) &&
    /Safari/.test(ua)
  )
}
