import bwipjs from 'bwip-js';

export async function generateBarcode(code: string, format = 'code128') {
  return new Promise((resolve, reject) => {
    bwipjs.toBuffer(
      {
        bcid: format, // code128, ean13, etc
        text: code,
        scale: 3,
        height: 10,
        includetext: true,
      },
      (err, png) => {
        if (err) return reject(err);

        const base64 = `data:image/png;base64,${png.toString('base64')}`;
        resolve(base64);
      }
    );
  });
}
