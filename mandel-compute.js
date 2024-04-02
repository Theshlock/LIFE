/* mandel-compute.js
   Compute the Mandelbrot Set, dumping the results in an integer array
   Copyright (c) 2019 - 2021 Greg Trounson greg@gart.nz
   Modification and distribution permitted under terms of the Affero GPL version 3
*/

self.onmessage = function (e) 
{
	const oneShot = e.data.oneShot;
	const screenX = e.data.screenX;
	const screenY = e.data.screenY;
	const zoom = e.data.zoom;
	const iter_max = e.data.iterations;
	var smooth = 0;
	var escapeSquared = 4;
	var firstIteration = -1;

	if( e.data.smooth == 1 ) {
		firstIteration = -3;
		escapeSquared = 256;
		smooth = 1;
		smoothOffset = 0.0;
		var log2 = Math.log2(2);
	}
	if( oneShot == 1 ) {
		// One-shot mode just returns value of single pixel
		// instead of the whole window.  So no arrays needed.
		// Used when hovering the mouse over the window
		var xStart = e.data.x;
		var yStart = e.data.y;
		var segmentHeight = yStart+1;
		var canvasWidth = xStart+1;
		var startLine = 0;
		var lblockSize = 1;

	} else {
		var mandelData = new Uint8Array( e.data.mandelBuffer );
		var smoothMandel = new Uint8Array( e.data.smoothMandel );

		var startLine = e.data.startLine;
		var workerID = e.data.workerID;
		var blockSize = e.data.blockSize;
		var canvasWidth = e.data.canvasWidth;
		var segmentHeight = e.data.segmentHeight;
		var lblockSize = blockSize == 1 ? 1 : blockSize/2;
		var lineCounter = 0;
		var xStart = 0;
		var yStart = 0;
	}
	//start = performance.now();

	for( let y=yStart; y<segmentHeight; y+=lblockSize ) {
 		let ynorm = (y+startLine - screenY)/zoom;
 		for( let x=xStart; x<canvasWidth; x+=lblockSize ) {
			let xnorm = (x - screenX)/zoom;
			let iteration = firstIteration;
			// Don't bother computing escape-time if we're in the main cardioid 
			// (or rather a small box inside the main cardioid)
			if(( xnorm > -0.5 ) && ( xnorm < 0.25 ) && ( ynorm > -0.5 ) && ( ynorm < 0.5 ))
				iteration = iter_max;
			else {
				// Does f(z) = z^2 + c diverge?
				let zr = 0.0;
				let zi = 0.0;
				// Call it diverging (bailout) if magnitude >= 2
				var zrSquared = 0.0;
				var ziSquared = 0.0;
			 	/* Some maths:
				 * z(next) = z^2 + c
				 * 	   = (zr+ziI)^2 + (x+y)
				 *	   = (zr+ziI)(zr+ziI) + (x+y)
				 *	   = (zr*zr) + 2*(zr*ziI) + (ziI*ziI) + (x+y)
				 *	   = (zr*zr) + 2*(zr*ziI) - (zi*zi) + (x+y)
				 */
				while( (zrSquared + ziSquared < escapeSquared ) && ( iteration < iter_max ) ) {
					zrSquared = zr*zr;
					ziSquared = zi*zi;
					let zr_prev = zr;
					zr = zrSquared - ziSquared + xnorm;
					zi = (zr_prev*2)*zi + ynorm;
					iteration++;
				}
			}
			if( oneShot ) {
				oneShotResult = iteration;
				self.postMessage( { oneShotResult:oneShotResult } );
				return 1;
			}
			if( smooth == 1 ) {
				smoothOffset = ( Math.log2( Math.log2( Math.sqrt( zrSquared + ziSquared )) / log2 ) -2 ) * 255;
				smoothMandel[x+y*canvasWidth] = Math.floor( smoothOffset );
			}
			if( iteration == iter_max ) 
				iteration = 255;
			else	
				iteration = iteration % 255;
			mandelData[x+y*canvasWidth] = iteration;
		}
		lineCounter++;
		if(( blockSize == 1 ) && ( lineCounter == 20 )) {
			self.postMessage( { lineCount:y, workerID:workerID } );
			lineCounter = 0;
		}
	}
	//end = performance.now() - start;
	//console.log("Compute worker "+ workerID + " done, blocksize "+blockSize);
	//console.log(screenX + " " + screenY);
	self.postMessage( {finished: 1, mandel:mandelData.buffer, workerID:workerID, smooth:smooth, smoothMandel:smoothMandel.buffer }, [mandelData.buffer],[smoothMandel.buffer]);
};

