/**
 * Opens the browser print dialog for the invoice on screen. Browsers name the PDF after the page title, so the
 * title is "Faktura <číslo>" until printing ends.
 */
export function printInvoice(invoiceNumber: string): void {
  const previous = document.title;
  const printTitle = `Faktura ${invoiceNumber}`;
  document.title = printTitle;
  window.addEventListener(
    'afterprint',
    () => {
      // A page change meanwhile has set its own title already.
      if (document.title === printTitle) document.title = previous;
    },
    { once: true },
  );
  window.print();
}
