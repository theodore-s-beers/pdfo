import * as PDFObject from './pdfobject'

const pdfOptions = {
  forceIframe: true,
  pdfOpenParams: {
    view: 'Fit',
  },
}

PDFObject.embed('dummy.pdf', '#pdf-box', pdfOptions)
