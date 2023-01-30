import * as pdfo from './pdfo'

const pdfOptions = {
  pdfOpenParams: {
    view: 'Fit'
  }
}

pdfo.embed('dummy.pdf', '#pdf-box', pdfOptions)
