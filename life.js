/* life.js
   Copyright (c) 2019 - 2021 Greg Trounson greg@gart.nz
   LIFE.
   Copyright (c) 2022 - 2024 Samuel Lockton lockton.sam@gmail.com
   Modification and distribution permitted under terms of the Affero GPL version 3
*/
if (typeof window.localStorage.xp == 'undefined') {localStorage.setItem("xp", 0);}
if (typeof window.localStorage.bestTime == 'undefined') {localStorage.setItem("bestTime", 300000);}
if (typeof window.localStorage.speed == 'undefined') {localStorage.setItem("speed", 1);}
if (typeof window.localStorage.control == 'undefined') {localStorage.setItem("control", 1);}
if (typeof window.localStorage.brakes == 'undefined') {localStorage.setItem("brakes", 1);}
if (typeof window.localStorage.xpGain == 'undefined') {localStorage.setItem("xpGain", 1);}
if (typeof window.localStorage.totalUpgrades == 'undefined') {localStorage.setItem("totalUpgrades", 0);}
if (typeof window.localStorage.ascension == 'undefined') {localStorage.setItem("ascension", 0);}

var level = 1;
function xpToLevel (xp) {return xp**0.2}
function levelToXp (level) {return level**5}
var portalLocations = [-1.999985881126867,0,-1.76877851023801,-0.00173889944794,-0.7428106660801,-0.126444300101,-0.77659226405,-0.136651039998,-0.17589070597346151,1.0866248318613803,-1.7442271377036995,-0.00004589744356394797,0.3855769028905207,0.1771223560991527,-0.5615337270936567,-0.641923504258619];
var portalX = portalLocations[0];
var portalY = portalLocations[1];
var portalDepth = 20000000000000000;
var zoom = 100;
var iterations = 1000;
const canvasWidth = 1600;
const canvasHeight = 1200;
const scaleFactor = 2;
const coarseWidth = canvasWidth/scaleFactor;
const coarseHeight = canvasHeight/scaleFactor;
var screenX = canvasWidth/2;
var screenY = canvasHeight/2;
var blockSize = new Uint8Array(16);
blockSize[0] = 16;
blockSize[1] = 16;
blockSize[2] = 16;
blockSize[3] = 16;
var colours = new Uint32Array(256);
var vga = new Uint32Array(256);
var currentPalette = 0;
var currentRotation = 0;
var renderCount = 0;
var destX = 0;
var destY = 0;
var computeWorker = new Array();
var computeWorkerRunning = new Uint8Array(16);
var renderWorker = new Array();
var renderWorkerRunning = new Uint8Array(16);
var needToRun = new Uint8Array(16);
var finished = new Uint8Array(16);
needToRun[0] = 0;
needToRun[1] = 0;
needToRun[2] = 0;
needToRun[3] = 0;
finished[0] = 0;
finished[1] = 0;
finished[2] = 0;
finished[3] = 0;
var workers = 4;
var workersRunning = 0;
const chunkHeight = canvasHeight / workers;
var needRedraw = 0;
var needRecompute = 1;
var smooth = 0;
var mc = document.getElementById("mandelCanvas");
mc.style = "width:" + window.innerWidth + "px; height:" + window.innerHeight + "px;"
contextM = mc.getContext('2d');
contextM.font = "40px Arial";
window.addEventListener("resize", function(){mc.style = "width:" + window.innerWidth + "px; height:" + window.innerHeight + "px;"});
var mctx = mc.getContext("2d", { alpha: false } );
var coarse = document.createElement('canvas');
var coarseCtx = coarse.getContext("2d", { alpha: false } );
coarse.width = coarseWidth;
coarse.height = coarseHeight;

// Off-screen Julia canvas
var offScreenSegment    = new Array();
var offScreenSegmentCtx = new Array();
var mSegment 		= new Array();
var mdSegment 		= new Array();
var coarseSegment 	= new Array();
var coarseSegmentCtx 	= new Array();
var mCoarseSegment 	= new Array();
var mdCoarseSegment 	= new Array();

var mandel = new Array();
var smoothMandel = new Array();
var percentDone = new Array();

for( i=0; i < workers; i++ ) {
	computeWorkerRunning[i] = 0;
	renderWorkerRunning[i] = 0;
	offScreenSegment[i] = document.createElement('canvas');
	offScreenSegmentCtx[i] = offScreenSegment[i].getContext("2d", { alpha: false } );
	offScreenSegment[i].width  = canvasWidth;
	offScreenSegment[i].height = canvasHeight / workers;
	mSegment[i] = offScreenSegmentCtx[i].getImageData( 0,0, canvasWidth, canvasHeight / workers );
	mdSegment[i] = new Uint8ClampedArray( canvasWidth * canvasHeight / workers *4 );
	mdSegment[i].set( mSegment[i].data );
	coarseSegment[i] = document.createElement('canvas');
	coarseSegmentCtx[i] = coarseSegment[i].getContext("2d", { alpha: false } );
	coarseSegment[i].width = coarseWidth;
	coarseSegment[i].height = coarseHeight / workers;
	mCoarseSegment[i] = coarseSegmentCtx[i].getImageData( 0,0, coarseWidth, coarseHeight / workers );
	mdCoarseSegment[i] = mCoarseSegment[i].data;
	mandel[i] = new Uint8Array( canvasWidth * (canvasHeight/workers) ) ;
	smoothMandel[i] = new Uint8Array( canvasWidth * (canvasHeight/workers) );
}

var worker = 0;

function killWorkers()
{
	for( var i=0; i<workers; i++ ) {
		if(( blockSize[i] < 4 ) && ( computeWorkerRunning[i] == 1 )) {
			computeWorker[i].terminate();
			computeWorker[i] = null;
			computeWorkerRunning[i] = 0;
			workersRunning--;
			mandel[i] = new Uint8Array( canvasWidth * (canvasHeight/workers) );
			smoothMandel[i] = new Uint8Array( canvasWidth * (canvasHeight/workers) );
		}
	}
}


// Create a Classic VGA palette
vga = [0,43520,11141120,11184640,2852126720,2852170240,2857697280,2863311360,1431655680,1431699200,1442796800,1442840320,4283782400,4283825920,4294923520,4294967040,0,336860160,538976256,741092352,943208448,1162167552,1364283648,1633771776,1903259904,2189591040,2459079168,2728567296,3065427456,3419130624,3823362816,4294967040,65280,1090584320,2097217280,3187736320,4278255360,4278238720,4278222080,4278206720,4278190080,4282449920,4286382080,4290641920,4294901760,3204382720,2113863680,1107230720,16711680,16728320,16743680,16760320,16776960,12517120,8257280,4325120,2105409280,2659057408,3195928320,3749576448,4286447360,4286439168,4286430720,4286422528,4286414080,4288576768,4290673920,4292836608,4294933760,3758062848,3204414720,2667543808,2113895680,2113904128,2113912320,2113920768,2113928960,2111831808,2109669120,2107571968,3065446144,3350658816,3686203136,3954638592,4290182912,4290177792,4290173696,4290168576,4290164224,4291278336,4292589056,4293637632,4294948352,3959404032,3690968576,3355424256,3070211584,3070215936,3070221056,3070225152,3070230272,3068919552,3067870976,3066560256,28928,469790976,939553024,1426092288,1895854336,1895847168,1895839744,1895832576,1895825408,1897660416,1899495424,1901395968,1903230976,1433468928,946929664,477167616,7405568,7412736,7419904,7427328,7434496,5599488,3698944,1863936,943223040,1161326848,1429762304,1631088896,1899524352,1899520256,1899517184,1899513088,1899509760,1900361728,1901410304,1902196736,1903245312,1634809856,1433483264,1165047808,946944000,946947328,946951424,946954496,946958592,945910016,945123584,944075008,1364291840,1498509568,1632727296,1766945024,1901162752,1901160704,1901158656,1901156608,1901154560,1901678848,1902203136,1902727424,1903251712,1769033984,1634816256,1500598528,1366380800,1366382848,1366384896,1366386944,1366388992,1365864704,1365340416,1364816128,16640,268452096,536887552,805323008,1090535680,1090531328,1090527232,1090523136,1090519040,1091567616,1092616192,1093664768,1094778880,809566208,541130752,272695296,4259840,4263936,4268032,4272128,4276480,3162368,2113792,1065216,538984704,673202432,807420160,941637888,1092632832,1092630528,1092628480,1092626432,1092624384,1093148672,1093672960,1094197248,1094787072,943792128,809574400,675356672,541138944,541140992,541143040,541145088,541147392,540557568,540033280,539508992,741097728,808206592,875315456,1009533184,1093419264,1093417984,1093415936,1093414912,1093413888,1093676032,1093938176,1094462464,1094790144,1010904064,876686336,809577472,742468608,742469632,742470656,742472704,742473984,742146304,741622016,741359872,0,0,0,0,0,0,0,0,];

function changePalette()
{
	var i;
	var r;
	var g;
	var b;
	currentRotation = 0;
	if ( currentPalette % 12 == 0 ) {
		for( i=0; i<255; i++ ) {
			if( i < 85 ) {
				r = 0 + i*3; g = 255 - i*3; b = 255;
			} else if( i < 170 ) {
				r = 255; g = 0 + (i-85)*3; b = 255 - (i-85)*3;
			} else {
				r = 255 - (i-170)*3; g = 255; b = 0 + (i-170)*3;
			}
			colours[i] = (r<<24) + (g<<16) + (b<<8);
		}
	} else if ( currentPalette % 12 == 1 ) {
		for( i=0; i<255; i++ ) {
			if( i < 32 ) {
				r = 0; g = 0; b = i*4;
			} else if( i < 64 ) {
				r = (i-32)*8; g = (i-32)*8; b = 127+(i-32)*4;
			} else if( i < 96 ){
				r = 255-(i-64)*8; g = 255-(i-64)*8; b = 255-(i-64)*4;
			} else if( i < 128 ){
				r = 0; g = 0; b = 127-(i-96)*4;
			} else if( i < 192 ) {
				r = 0; g = 0; b = (i-128);
			} else  {
				r = 0; g = 0; b = 63 - (i-192);
			}
			colours[i] = (r<<24) + (g<<16) + (b<<8);
		}
	} else if ( currentPalette % 12 == 2 ) {
		for( i=0; i<255; i++ ) {
			if( i < 64 ) {
				r = i*4; g = 0; b = 0;
			} else if( i < 128 ) {
				r = 255; g = (i-64)*2; b = 0;
			} else if( i < 192 ){
				r = 255; g = 128-((i-128)*2); b = 0;
			} else {
				r = 255-(i-192)*4; g = 0; b = 0;
			}
			colours[i] = (r<<24) + (g<<16) + (b<<8);
		}
	} else if ( currentPalette % 12 == 3 ) {
		for( i=0; i<255; i++ ) {
			if( i < 32 ) {
				r = 54 + Math.floor((i)*(224-54)/32); g = 11 + Math.floor((i)*(115-11)/32); b = 2 + Math.floor((i)*(10-2)/32);
			}
			else if( i < 64 ) {
				r = 224 + Math.floor((i-32)*(255-224)/32); g = 115 + Math.floor((i-32)*(192-115)/32); b = 10 + Math.floor((i-32)*(49-10)/32);
			}
			else if( i < 192 ) {
				r = 255; g = 192 + Math.floor((i-64)*(255-192)/128); b = 49 + Math.floor((i-64)*(166-49)/128);
			}
			else if( i < 224 ) {
				r = 255; g = 255 + Math.floor((i-192)*(192-255)/32); b = 166 + Math.floor((i-192)*(49-166)/32);
			}
			else {
				r = 255 + Math.floor((i-224)*(54-255)/32); g = 192 + Math.floor((i-224)*(11-192)/32); b = 49 + Math.floor((i-224)*(2-49)/32);
			}
			colours[i] = (r<<24) + (g<<16) + (b<<8);
		}
	} else if ( currentPalette % 12 == 4 ) {
		for( i=0; i<255; i++ ) {
			if( i < 85 ) {
				r = 255 - i*3; g = 0 + i*3; b = 0;
			} else if( i < 170 ) {
				r = 0; g = 255 - (i-85)*3; b = 0 + (i-85)*3;
			} else {
				r = 0 + (i-170)*3; g = 0; b = 255 - (i-170)*3;
			}
			colours[i] = (r<<24) + (g<<16) + (b<<8);
		}
	} else if ( currentPalette % 12 == 5 ) {
		for( i=0; i<255; i++ ) {
			if( i < 85 ) {
				r = 255 - i*3/2; g = 127 - i*3/2; b = 0 + i * 3;
			} else if( i < 170 ) {
				r = 127 - (i-85)*3/2; g = 0 + (i-85)*3; b = 255 - (i-85)*3/2;
			} else {
				r = 0 + (i-170)*3; g = 255 - (i-170)*3/2; b = 127 - (i-170)*3/2;
			}
			colours[i] = (r<<24) + (g<<16) + (b<<8);
		}
	} else if ( currentPalette % 12 == 6 ) {
		for( i=0; i<255; i++ ) {
			if( i < 85 ) {
				r = 255 - i*3; g = 0 + i*3/2; b = 127 + i * 3/2;
			} else if( i < 170 ) {
				r = 0 + (i-85)*3/2; g = 127 + (i-85)*3/2; b = 255 - (i-85)*3;
			} else {
				r = 127 + (i-170)*3/2; g = 255 - (i-170)*3; b = 0 + (i-170)*3/2;
			}
			colours[i] = (r<<24) + (g<<16) + (b<<8);
		}
	} else if ( currentPalette % 12 == 7 ) {
		for( i=0; i<255; i++ ) {
			if( i < 32 ) {
				r = i*4; g = 0; b = i*8;
			} else if( i < 64 ) {
				r = 124-(i-32)*4; g = 0; b = 248-(i-32)*8;
			} else if( i < 96 ){
				r = (i-64)*8; g = (i-64)*4; b = 0;
			} else if( i < 128 ){
				r = 248-(i-96)*8; g = 124-(i-96)*4; b = 0;
			} else if( i < 160 ) {
				r = 0; g = (i-128)*4; b = (i-128)*8;
			} else if( i < 192 ) {
				r = 0; g = 124-(i-160)*4; b = 248-(i-160)*8;
			} else if( i < 224 ) {
				r = (i-192)*4; g = (i-192)*8; b = (i-192)*4;
			} else  {
				r = 124-(i-224)*4; g = 248-(i-224)*8; b = 124-(i-224)*4;
			}
			colours[i] = (r<<24) + (g<<16) + (b<<8);
		}
	} else if ( currentPalette % 12 == 8 ) {
		for( i=0; i<255; i++ ) {
			if( i < 32 ) {
				r = i*8; g = i*8; b = 127-i*4;
			} else if( i < 128 ) {
				r = 255; g = 255-(i-32)*8/3; b = (i-32)*4/3;
			} else if( i < 192 ){
				r = 255 - (i-128)*4; g = 0 + (i-128)*3; b = 127 - (i-128);
			} else {
				r = 0; g = 192-(i-192)*3; b = 64+(i-192);
			}
			colours[i] = (r<<24) + (g<<16) + (b<<8);
		}
	} else if ( currentPalette % 12 == 9 ) {
		for( i=0; i<255; i++ ) {
			if( i % 4 == 0 )
				colours[i] = 0;
			else if( i % 4 == 1 )
				colours[i] = 1442796800;
			else if( i % 4 == 2 )
				colours[i] = 4283782400;
			else if( i % 4 == 3 )
				colours[i] = 4294923520;
		}
	} else if ( currentPalette % 12 == 10 ) {
		for( i=0; i<255; i++ ) {
			if( i % 4 == 0 ) {
				r = 100; g = 20; b = 200;
			}
			else if ( i % 4 == 1 ) {
				r = 220; g = 112; b = 0;
			}
			else if ( i % 4 == 2 ) {
				r = 230; g = 120; b = 0;
			}
			else {
				r = 255; g = 128; b = 0;
			}
			colours[i] = (r<<24) + (g<<16) + (b<<8);
		}
	} else if ( currentPalette % 12 == 11 ) {
		for( i=0; i<255; i++ ) {
			colours[i] = vga[i % 256];
		}
	}
	startRender( 0,0 );
}
changePalette();

var onComputeEnded = function (e)
{
	if( ! e.data.finished ) {
		if( blockSize[e.data.workerID] == 1 ) {
			percentDone[e.data.workerID] = Math.round(e.data.lineCount/(canvasHeight/workers)*100);
			progress = Math.floor( ( percentDone[0] + percentDone[1] + percentDone[2] + percentDone[3]) / 4);
		}
		return 1;
	}
	var workerID = e.data.workerID;
	computeWorkerRunning[workerID] = 0;
	mandel[workerID] = new Uint8Array( e.data.mandel );
	smoothMandel[workerID] = new Uint8Array( e.data.smoothMandel );
	while( renderWorkerRunning[workerID] != 0 ) {
		console.log("Waiting for worker to end");}
	if( ! renderWorker[workerID] ) {
		renderWorker[workerID] = new Worker("mandel-render.js");
		renderWorker[workerID].onmessage = onRenderEnded;
	}
	renderWorkerRunning[workerID] = 1;
	if( blockSize[workerID] == 1 )
		renderWorker[workerID].postMessage({ colours:colours, mandel:mandel[workerID].buffer, canvasBuffer:mdSegment[workerID].buffer, workerID:workerID, blockSize:blockSize[workerID], arrayWidth:canvasWidth, smooth:smooth, smoothMandel:smoothMandel[workerID].buffer }, [mandel[workerID].buffer],[smoothMandel[workerID].buffer],[mdSegment[workerID].buffer] );
	else
		renderWorker[workerID].postMessage({ colours:colours, mandel:mandel[workerID].buffer, canvasBuffer:mdCoarseSegment[workerID].buffer, workerID:workerID, blockSize:blockSize[workerID], arrayWidth:coarseWidth,smooth:smooth, smoothMandel:smoothMandel[workerID]}, [mandel[workerID].buffer],[mdCoarseSegment[workerID].buffer],[smoothMandel[workerID].buffer] );
}

var onRenderEnded = function (e)
{
	var workerID = e.data.workerID;
	mandel[workerID] = new Uint8Array( e.data.mandelBuffer );
	smoothMandel[workerID] = new Uint8Array( e.data.smoothMandel );
	if( e.data.blockSize == 1 )
		mdSegment[workerID] = new Uint8ClampedArray( e.data.pixelsBuffer );
	else
		mdCoarseSegment[workerID] = new Uint8ClampedArray( e.data.pixelsBuffer );
	renderWorkerRunning[workerID] = 0;
	workersRunning--;
	if( renderCount++ >= 20 ) {
		// Kill the render worker every few iterations to prompt faster GC
		renderCount = 0;
		renderWorker[workerID].terminate();
		renderWorker[workerID] = null;
		renderWorker[workerID] = new Worker("mandel-render.js");
		renderWorker[workerID].onmessage = onRenderEnded;
		// Hack to keep "zoom" variable an Integer after a deep zoom
		var zoomTmp = Math.floor(zoom);
		delete zoom;
		window.zoom = zoomTmp;
		//console.log( ' '+screenX+' '+screenY+' '+zoom+' '+typeof(zoom)+' '+iterations );
	}
	var lstartLine;

	if( e.data.blockSize == 1 ) {
		finished[workerID] = 1;
		mSegment[workerID].data.set(mdSegment[workerID]);
		lstartLine = Math.floor( workerID * chunkHeight );
		//mctx.drawImage(offScreen, 0, 0, canvasWidth/scaleFactor, canvasHeight/scaleFactor);
	} else {
		mCoarseSegment[workerID].data.set(mdCoarseSegment[workerID]);
		lstartLine = Math.floor( workerID * chunkHeight / scaleFactor );
		coarseCtx.putImageData( mCoarseSegment[workerID], 0,lstartLine );
		mctx.drawImage( coarse, 0, 0 );
	}
	if(( blockSize[workerID] >= 2 ) && ( ! eventOccurred )) {
			needToRun[workerID] = 1;
			blockSize[workerID]/=2;
	} else
		needToRun[workerID] = 0;

};


needRedraw = 0;
oneShotWorker = new Worker("mandel-compute.js");

// Set Alpha channel on the canvas to "solid" (not transparent)
for( let i=0; i<workers; i++ ) {
	for( let y=0; y<canvasHeight/workers; y++ ) {
		for( let x=0; x<canvasWidth; x++ ) {
			let pixelPos = (x+y*canvasWidth)*4;
			mdSegment[i][pixelPos+3] = 255;
		}
	}
	for( let y=0; y<coarseHeight/workers; y++ ) {
		for( let x=0; x<coarseWidth; x++ ) {
			let pixelPos = (x+y*coarseWidth)*4;
			mdCoarseSegment[i][pixelPos+3] = 255;
		}
	}
}
eventTime = performance.now();
needRedraw = 1;
startRender( 1,1 );
function startRender( lneedRecompute, blocky )
{
	for( i=0; i<workers; i++ ) {
		needToRun[i] = 1;
		finished[i] = 0;
		percentDone[i] = 0;
		if( (lneedRecompute == 1 ) && ( blocky == 1 ))
			blockSize[i] = 8;
		else
			blockSize[i] = 1;
	}
	needRedraw = 1;
	needRecompute = lneedRecompute;
	eventOccurred = 0;
	requestAnimationFrame( drawMandel );
}

function drawMandel()
{
	for( i=0; i<workers; i++ )
			needRedraw = 1;
		if( needRedraw ) {
			// Spawn compute workers
			for( i=0; i<workers; i++ ) {
				startLine = chunkHeight*i;
				if(( needToRun[i] == 1 ) && ( ! eventOccurred ) ) {
					if( renderWorkerRunning[i] ) {
						continue;
					}
					if( computeWorkerRunning[i] ) {
						continue;
					}
					if( needRecompute ) {
						if( ! computeWorker[i] ) {
							computeWorker[i] = new Worker("mandel-compute.js");
							computeWorker[i].onmessage = onComputeEnded;
						}
						// Compute the fractal
						workersRunning++;
						computeWorkerRunning[i] = 1;
						//console.log("About to spawn compute worker "+i+" block size "+blockSize[i]);
						if( blockSize[i] == 1 )
							computeWorker[i].postMessage({ mandelBuffer:mandel[i].buffer, workerID:i, startLine:startLine, blockSize:blockSize[i], canvasWidth:canvasWidth, segmentHeight: chunkHeight, screenX:screenX, screenY:screenY, zoom:zoom, iterations:iterations, oneShot:0, smooth:smooth, smoothMandel:smoothMandel[i].buffer }, [mandel[i].buffer],[smoothMandel[i].buffer]);
						else
							computeWorker[i].postMessage({ mandelBuffer:mandel[i].buffer, workerID:i, startLine:startLine/scaleFactor, blockSize:blockSize[i], canvasWidth:coarseWidth, segmentHeight: chunkHeight/2, screenX:screenX/scaleFactor, screenY:screenY/scaleFactor, zoom:zoom/scaleFactor, iterations:iterations, oneShot:0, smooth:smooth, smoothMandel:smoothMandel[i].buffer }, [mandel[i].buffer], [smoothMandel[i].buffer]);
					}
					else {
						// Just redraw if we don't need to compute the fractal
						workersRunning++;
						if( ! renderWorker[i] ) {
							renderWorker[i] = new Worker("mandel-render.js");
							renderWorker[i].onmessage = onRenderEnded;
						}
						renderWorkerRunning[i] = 1;
						renderWorker[i].postMessage({ colours:colours, mandel:mandel[i].buffer, canvasBuffer:mdSegment[i].buffer, workerID:i, blockSize:blockSize[i], arrayWidth:canvasWidth, smooth:smooth, smoothMandel:smoothMandel[i].buffer }, [mandel[i].buffer],[smoothMandel[i].buffer],[mdSegment[i].buffer] );
					}
				}
			}
		}
		else
			requestAnimationFrame( drawMandel );
}

function chooseCoord() {
    const maxIterations = 1000;
    const coordSens = 0.25;
    const blockSize = 64;
    const totalZooms = 64;
    var boundsSize = 2;
    var chosenCoordX = 0;
    var chosenCoordY = 0;
    var chosenCoordX_ = 0;
    var chosenCoordY_ = 0;
    var escapeSquared = 4;
    var eligiblePoints = [];
    for (i = 0; i < totalZooms; i++) {
        for (xVal = 1; xVal < blockSize; xVal++) {
            x = ( ( chosenCoordX - boundsSize ) + ( ( boundsSize / blockSize ) * xVal * 2) )
            for (yVal = 1; yVal < blockSize; yVal++) {
                y = ( ( chosenCoordY - boundsSize ) + ( ( boundsSize / blockSize ) * yVal * 2) )

                iteration = 0;
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
                while( (zrSquared + ziSquared < escapeSquared ) && ( iteration < maxIterations ) ) {
                    zrSquared = zr*zr;
                    ziSquared = zi*zi;
                    let zr_prev = zr;
                    zr = zrSquared - ziSquared + x;
                    zi = (zr_prev*2)*zi + y;
                    iteration++;
                }
                if ( (iteration > ( maxIterations * coordSens ) ) && (iteration !== maxIterations ) ) {
                        chosenCoordX_ = x;
                        chosenCoordY_ = y;
                        eligiblePoints.push([chosenCoordX_, chosenCoordY_])
                        // A better idea would be to add to an array 
                }
            }
        }
        // And pick a random coordinate here
        pick = Date.now() % eligiblePoints.length;
        chosenCoordX = eligiblePoints[pick][0];
        chosenCoordY = eligiblePoints[pick][1];
        boundsSize = boundsSize / 4;
    }
    console.log("completed succesfully")
    console.log(iteration)
    console.log("chosenCoordX: " + chosenCoordX)
    console.log("chosenCoordY: " + chosenCoordY)
    return([chosenCoordX,chosenCoordY])
}

// Input Code
var xRate = 0;
var yRate = 0;
var up = 0;
var down = 0;
var left = 0;
var right = 0;

window.onkeydown = function(event) {
    if (event.keyCode === 39) {right = 1}; 
    if (event.keyCode === 37) {right = -1}; 
    if (event.keyCode === 38) {up = -1}; 
    if (event.keyCode === 40) {up = 1}; 
};

window.onkeyup = function(event) {
    if (event.keyCode === 39 || event.keyCode === 37) { right = 0; }
    if (event.keyCode === 38 || event.keyCode === 40) { up = 0; }
};

document.ontouchstart = function(e){
	right = (e.touches[0].clientX - window.innerWidth / 2) / (window.innerWidth / 2);
	up = (e.touches[0].clientY - window.innerHeight / 2) / (window.innerHeight / 2);
}

document.ontouchmove = function(e){
	right = (e.touches[0].clientX - window.innerWidth / 2) / (window.innerWidth / 2);
	up = (e.touches[0].clientY - window.innerHeight / 2) / (window.innerHeight / 2);
}

document.ontouchcancel = function(e) {
	right = 0;
	up = 0;
}

document.ontouchend = function(e) {
	right = 0;
	up = 0;
}


//State
function gameloop() {
	if (gamestate == "menu") {
		if (window.localStorage.xp == 0) {
			contextM.fillText("Seek the portal",20,20);
		}

		zoom *= 1.02;
		screenX = Math.round(-xnorm * zoom + canvasWidth/2);
		screenY = Math.round(-ynorm * zoom + canvasHeight/2);
		startRender(1,1);

		contextM.fillText("Ascension " + window.localStorage.ascension,20,120);
		contextM.fillText("Upgrades Available " + (window.localStorage.ascension + Math.floor(xpToLevel(window.localStorage.xp)) - window.localStorage.totalUpgrades),20,160);


		contextM.fillText("Speed",20,240);
		contextM.fillRect(20,240,window.localStorage.speed*1000-1000,10)

		contextM.fillText("Control",20,300);
		contextM.fillRect(20,300,window.localStorage.control*100 - 100,10)

		contextM.fillText("Brakes",20,360);
		contextM.fillRect(20,360,window.localStorage.brakes*1000 - 1000,10)

		contextM.fillText("Xp Gain",20,420);
		contextM.fillRect(20,420,window.localStorage.xpGain*100 - 100,10)

		contextM.fillText(Math.floor(xpToLevel(animationXp)),20,560);
		contextM.fillText(Math.floor(xpToLevel(animationXp)+1),740,560);
		contextM.fillRect(0,560,xpToLevel(animationXp)%1*800,20);
		if (animationXp < Number(window.localStorage.xp)) {
			animationXp += Number(window.localStorage.xp)/200 + 1
		} else {
			contextM.fillText("You need " + Math.round((levelToXp(Math.floor(xpToLevel(Number(window.localStorage.xp)))+1) - Number(window.localStorage.xp))) + " xp to level up",200,550);
			if (window.localStorage.upgradePoints > 0) {
				document.getElementById("upgrade menu").style.display = "flex";
			}
		}
	} else if (gamestate == "time attack") {
		if (level == 8) {
			finalGameTime = Date.now()-startTime;
			contextM.fillText("You win",300,200);
			contextM.fillText("final time: " + finalGameTime ,300,260);
			localStorage.setItem("xp", Number(window.localStorage.xp) + bonus);
			if (Number(window.localStorage.bestTime) > finalGameTime) {
				localStorage.setItem("bestTime", finalGameTime);
				contextM.fillText("new best time!",500,150);
			}
			contextM.fillText("best time: " + window.localStorage.bestTime ,300,320);
		} else if (zoom > portalDepth ) {
			bonus = Math.round(multiplier*1000)/1000
			localStorage.setItem("xp", Number(window.localStorage.xp)+bonus)
			level++;
			zoom = 10;
			portalX = portalLocations[2*level];
			portalY = portalLocations[2*level + 1];
			xnorm = 0; ynorm = 0; xRate = 0; yRate = 0;
			currentPalette++;
			changePalette();
		} else {
			contextM.fillRect( (((portalX-xnorm) * zoom + 800) / 2 ) - (20 + zoom/portalDepth*1000) / 2, (((portalY-ynorm) * zoom + 600) / 2 ) - (20 + zoom/portalDepth*1000) / 2, 20 + zoom/portalDepth*1000, 20 + zoom/portalDepth*1000 );
			xRate += (right * window.localStorage.control) * ( Date.now() - time ) / 100;
			xRate /= window.localStorage.brakes
			yRate += (up * window.localStorage.control) * ( Date.now() - time ) / 100;
			yRate /= window.localStorage.brakes
			xnorm += ( xRate / zoom ) * ( Date.now() - time)  / 10;
			ynorm += ( yRate / zoom ) * ( Date.now() - time ) / 10;
			multiplier = -0.5 - Math.log2(((((xnorm - portalX)*zoom)/1600)**2 + ((ynorm-portalY)*zoom/1200)**2)**0.5);
			zoom *= (1 + 0.01 * multiplier) * window.localStorage.speed;
			screenX = Math.round(-xnorm * zoom + canvasWidth/2);
			screenY = Math.round(-ynorm * zoom + canvasHeight/2);

			contextM.fillText(Date.now()-startTime,100,550);
			contextM.fillText("△: " + Math.round(multiplier*1000)/1000 ,360,550);
			contextM.fillText(level + "/7",620,550);
			contextM.fillText("+" + Math.round(bonus*1000)/1000,100,500);

			time = Date.now();
			startRender(1,1);
		}
	} else if (gamestate == "zen") {
		if (zoom > portalDepth ) {
			bonus = Math.round(multiplier*1000)/1000
			localStorage.setItem("xp", Number(window.localStorage.xp)+bonus)
			level += 1;
			zoom = 10;
			xnorm = 0; ynorm = 0; xRate = 0; yRate = 0;
			xy = chooseCoord()
			portalX = xy[0]
			portalY = xy[1]
			currentPalette++;
			changePalette();
		} else {
			contextM.fillRect( (((portalX-xnorm) * zoom + 800) / 2 ) - (20 + zoom/portalDepth*1000) / 2, (((portalY-ynorm) * zoom + 600) / 2 ) - (20 + zoom/portalDepth*1000) / 2, 20 + zoom/portalDepth*1000, 20 + zoom/portalDepth*1000 );
			xRate += (right * window.localStorage.control) * ( Date.now() - time ) / 100;
			xRate /= window.localStorage.brakes
			yRate += (up * window.localStorage.control) * ( Date.now() - time ) / 100;
			yRate /= window.localStorage.brakes
			xnorm += ( xRate / zoom ) * ( Date.now() - time)  / 10;
			ynorm += ( yRate / zoom ) * ( Date.now() - time ) / 10;
			multiplier = -0.5 - Math.log2(((((xnorm - portalX)*zoom)/1600)**2 + ((ynorm-portalY)*zoom/1200)**2)**0.5);
			zoom *= (1 + 0.01 * multiplier) * window.localStorage.speed;
			contextM.fillText(Date.now()-startTime,100,550);
			contextM.fillText("△: " + Math.round(multiplier*1000)/1000 ,360,550);
			contextM.fillText(level,620,550);
			contextM.fillText("+" + Math.round(bonus*1000)/1000,100,500);
			time = Date.now();
			screenX = Math.round(-xnorm * zoom + canvasWidth/2);
			screenY = Math.round(-ynorm * zoom + canvasHeight/2);
			startRender(1,1);
		}
	}
	window.requestAnimationFrame(gameloop);
}

var time = Date.now();

//State Control
function menu() {
	gamestate="menu";
	document.getElementById("menu").style.display = "none";
	document.getElementById("time attack").style.display = "flex";
	document.getElementById("zen").style.display = "flex";
	menuConditionals()
	level = 1;
	bonus = 0;
	score = 0;
	xRate = 0;
	yRate - 0;
	xnorm = -0.5615337270936567;
	ynorm = -0.641923504258619;
	zoom = 10;
	animationXp = 0
	winScreenRendered = 0
	contextM.fillStyle = 'green';
	window.requestAnimationFrame(gameloop);
}

function menuConditionals() {
	// Show upgrade menu if conditions level+ascension is greater than number of upgrades already redeemed
	if (window.localStorage.ascension + Math.floor(xpToLevel(window.localStorage.xp)) - window.localStorage.totalUpgrades > 0)
		{document.getElementById("upgrade menu").style.display = "flex"}
	else
		{document.getElementById("upgrade menu").style.display = "none"}

	// Show downgrade menu if level+ascension is greater than 1 and upgrade points
	if (window.localStorage.totalUpgrades != 0) 
		{document.getElementById("downgrade menu").style.display = "flex"}
	else
		{document.getElementById("downgrade menu").style.display = "none"}

	//show ascension button if conditions are met
	if (Math.floor(xpToLevel(window.localStorage.xp)) > window.localStorage.ascension) 
		{document.getElementById("ascend").style.display = "flex"}
	else
		{document.getElementById("ascend").style.display = "flex"}
		
	// ascension
	if (window.localStorage.ascension + Math.floor(xpToLevel(window.localStorage.xp)) > window.localStorage.totalUpgrades) {
		document.getElementById("upgrade menu").style.display = "flex"
	}
}
menu()
function timeAttack() {
	gamestate = "time attack";
	document.getElementById("menu").style.display = "flex";
	document.getElementById("time attack").style.display = "none";
	document.getElementById("zen").style.display = "none";
	document.getElementById("upgrade menu").style.display = "none"
	document.getElementById("downgrade menu").style.display = "none"

	zoom = 10;
	startTime = Date.now()
}
function zen() {
	gamestate = "zen"
	document.getElementById("menu").style.display = "flex";
	document.getElementById("time attack").style.display = "none";
	document.getElementById("zen").style.display = "none";
	document.getElementById("upgrade menu").style.display = "none"
	document.getElementById("downgrade menu").style.display = "none"

	zoom = 10;
	startTime = Date.now()
	console.log(chooseCoord())
	xy = chooseCoord()
	console.log(xy)
	portalX = xy[0]
	portalY = xy[1]
}

function ascend() {
	localStorage.setItem("totalUpgrades", 0)
	localStorage.setItem("ascension", Math.floor(xpToLevel(window.localStorage.xp)))
	localStorage.setItem("xp", 0)
	localStorage.setItem("speed", 1)
	localStorage.setItem("control", 1)
	localStorage.setItem("brakes", 1)
	localStorage.setItem("xpGain", 1)
}


function upgrade(x) {
	if (x == "speed") {
		localStorage.setItem("speed", Number(window.localStorage.speed) + 0.01)
	}
	if (x == "control") {
		localStorage.setItem("control", Number(window.localStorage.control) + 0.1)
	}
	if (x == "brakes") {
		localStorage.setItem("brakes", Number(window.localStorage.brakes) + 0.01)
	}
	if (x == "xpGain") {
		localStorage.setItem("xpGain", Number(window.localStorage.xpGain) + 0.1)
	}
	localStorage.setItem("totalUpgrades", Number(window.localStorage.totalUpgrades) + 1)
	menuConditionals()
}

function downgrade(x) {
	if (x == "speed") {
		localStorage.setItem("speed", Number(window.localStorage.speed) - 0.01)
	}
	if (x == "control") {
		localStorage.setItem("control", Number(window.localStorage.control) - 0.1)
	}
	if (x == "brakes") {
		localStorage.setItem("brakes", Number(window.localStorage.brakes) - 0.01)
	}
	if (x == "xpGain") {
		localStorage.setItem("xpGain", Number(window.localStorage.xpGain) - 0.1)
	}
	localStorage.setItem("totalUpgrades", Number(window.localStorage.totalUpgrades) - 1)
	menuConditionals()
}

function cycleSkins() {
	console.log("this function is under construction")
}