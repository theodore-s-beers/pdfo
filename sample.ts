import * as pdfo from './pdfo'

const pdfOptions = {
  forceIframe: true,
  pdfOpenParams: {
    view: 'Fit'
  }
}

pdfo.embed('dummy.pdf', '#pdf-box', pdfOptions)
