// Minimal type declaration for jsqr (https://github.com/cozmo/jsQR)
// Used for QR code decoding from canvas ImageData.
declare module 'jsqr' {
  interface Point {
    x: number;
    y: number;
  }
  interface QRCode {
    data: string;
    binaryData: number[];
    location: {
      topRightCorner: Point;
      topLeftCorner: Point;
      bottomRightCorner: Point;
      bottomLeftCorner: Point;
    };
  }
  export default function jsQR(
    data: Uint8ClampedArray,
    width: number,
    height: number,
    options?: { inversionAttempts?: 'dontInvert' | 'onlyInvert' | 'attemptBoth' | 'invertFirst' }
  ): QRCode | null;
}
