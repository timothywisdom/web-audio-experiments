window.tPlayer = {

	audioContext: null,
	audioBuffer: null,
	audioSourceNode: null,
	ready: false,
	status: "empty",
	seekPostion: 0,

	gui: {
		play: "tPlayer-play",
		pause: "tPlayer-pause",
		stop: "tPlayer-stop",
		load: "tPlayer-load",
		volume: "tPlayer-volume",
		seek: "tPlayer-seek",
		urlInput: "tPlayer-url-input",
		canvas: "canvas"
	},

	init: function() {
		tPlayer.audioContext = new(window.AudioContext || window.webkitAudioContext)();

		console.log("audioContext is ready", tPlayer.audioContext);

		tPlayer.ready = true;
		tPlayer.status = "init";
		tPlayer.canvas = document.querySelector('#' + tPlayer.gui.canvas);
		tPlayer.canvasCtx = tPlayer.canvas.getContext("2d");

		var WIDTH = tPlayer.canvas.width;
  		var HEIGHT = tPlayer.canvas.height;

		tPlayer.canvasCtx.clearRect(0, 0, WIDTH, HEIGHT);
	},

	onError: function(e) {
		console.log("Error:", e);
	},

	playSoundFromUrl: function(url) {
		tPlayer.loadAudioFromUrl(url);
	},

	loadAudioFromGUI: function() {
		var url = document.getElementById(tPlayer.gui.urlInput).value;
		tPlayer.loadAudioFromUrl(url);
	},

	loadAudioFromUrl: function(url) {
		if (tPlayer.ready) {
			console.log("Setting up XMLHttpRequest");
			var request = new XMLHttpRequest();
	        request.open('GET', url, true);
	        request.responseType = 'arraybuffer';
	        // When loaded decode the data and store the audio buffer in memory
	        request.onload = function() {
	        	console.log("Loaded audio from url", url);
	            tPlayer.audioContext.decodeAudioData(request.response, function(buffer) {
	            	tPlayer.audioBuffer = buffer;
	            	tPlayer.status = "loaded";
	                console.log("Audio Buffer is loaded");
	            }, tPlayer.onError);
	        }
	        request.send();	
		}		
	},

	playAudioFromGUI: function() {
		if ( tPlayer.audioBuffer != null ) {
			tPlayer.playSoundFromBuffer();
		} else {
			console.log("Audio Buffer is empty. Call loadAudioFromUrl first");
		}
	},

	playSoundFromBuffer: function() {
		if (tPlayer.ready) {
			tPlayer.audioSourceNode = tPlayer.audioContext.createBufferSource();
        	tPlayer.audioSourceNode.buffer = tPlayer.audioBuffer;
        	tPlayer.audioSourceNode.onended = tPlayer.events.onEnded;

        	tPlayer.analyser = tPlayer.audioContext.createAnalyser();
        	
        	// Connect all the AudioNodes into a graph. Start with source and end with destination
        	tPlayer.audioSourceNode.connect(tPlayer.analyser);
        	tPlayer.analyser.connect(tPlayer.audioContext.destination);

        	tPlayer.audioSourceNode.start(tPlayer.seekPostion);
        	tPlayer.status = "playing";
        	tPlayer.analyseAudio();
        }
	},

	stopAudioFromGUI: function() {
		tPlayer.audioSourceNode.stop();
		window.cancelAnimationFrame(tPlayer.animationFrame);
		tPlayer.status = "stopped";
	},

	analyseAudio: function() {
		tPlayer.animationFrame = window.requestAnimationFrame(tPlayer.analyseAudio);

    	tPlayer.analyser.fftSize = 32768; //128; // 2048;
        tPlayer.analyser.minDecibels = -100; //-90;
		tPlayer.analyser.maxDecibels = 0; //-10;
		tPlayer.analyser.smoothingTimeConstant = 0.85;

		var timeBufferLength = tPlayer.analyser.fftSize;
		var timeArray = new Uint8Array(timeBufferLength);
		tPlayer.analyser.getByteTimeDomainData(timeArray);

    	tPlayer.analyser.fftSize = 32*2; // 2048;

    	var freqBufferLength = tPlayer.analyser.frequencyBinCount; // This is half of analyser.fftSize
		var freqArray = new Uint8Array(freqBufferLength);
		tPlayer.analyser.getByteFrequencyData(freqArray);

		//console.log("timeArray", timeArray);
		//console.log("freqArray", freqArray);

		tPlayer.drawToCanvas(timeArray, freqArray, timeBufferLength, freqBufferLength);
	},

	drawToCanvas: function(timeArray, freqArray, timeBufferLength, freqBufferLength) {
		var WIDTH = tPlayer.canvas.width;
  		var HEIGHT = tPlayer.canvas.height;
  		var i = 0;

		tPlayer.canvasCtx.fillStyle = 'rgb(250, 250, 250)';
		tPlayer.canvasCtx.fillRect(0, 0, WIDTH, HEIGHT);



		// Freq Visual
		var barWidth = Math.floor(WIDTH / freqBufferLength);  //Math.floor((WIDTH - freqBufferLength) / freqBufferLength); // * 2.5;
		if (barWidth < 1) barWidth = 1;
		var barHeight;
		var x = 0;

		var redWeight = 1;
		var greenWeight = 1;
		var blueWeight = 1;
		var midFreqBufferLength = Math.floor(freqBufferLength/2);
		var bufferLength = freqBufferLength-1;

		var redColor = 0;
		var greenColor = 0;
		var blueColor = 0;
		var barColor = 0;

		var redScale = 0;
		var greenScale = 0;
		var blueScale = 0;

		var colors = [];
		var mainRGB = [0,0,0];

		for (i = 0; i < freqBufferLength; i++) {
			barHeight = freqArray[i];

			redWeight = 1 - (i/bufferLength);
			blueWeight = (i/bufferLength);
			if (i < midFreqBufferLength) {
				greenWeight = (i/(midFreqBufferLength-1));
			} else if (i > midFreqBufferLength) {
				greenWeight = 1 - (i/bufferLength);
			} else {
				greenWeight = 1;
			}

			redColor = Math.floor((barHeight + redScale)*redWeight);
			greenColor = Math.floor((barHeight + greenScale)*greenWeight);
			blueColor = Math.floor((barHeight + blueScale)*blueWeight);

			barColor = "rgba(" + redColor + "," + greenColor + "," + blueColor + ",0.6)";

			mainRGB[0] = Math.max(mainRGB[0], redColor);
			mainRGB[1] = Math.max(mainRGB[1], greenColor);
			mainRGB[2] = Math.max(mainRGB[2], blueColor);

			//colors += (i + ":" + barHeight + ":" + barColor + " = (" + mainRGB[0] + "," + mainRGB[1] + "," + mainRGB[2] + ") ");

			tPlayer.canvasCtx.fillStyle = barColor;
			tPlayer.canvasCtx.fillRect(x,HEIGHT-barHeight,barWidth,barHeight);

			x += barWidth + 1;
		}

		var mainRGBColor = 'rgba(' + mainRGB[0] + ',' + mainRGB[1] + ',' + mainRGB[2] + ', 0.9)';

		colors.push(mainRGBColor);

		console.log("mainRGBColor", mainRGBColor);





  		// Time Visual
		tPlayer.canvasCtx.lineWidth = 1;
		tPlayer.canvasCtx.strokeStyle = mainRGBColor;

		tPlayer.canvasCtx.beginPath();

		var sliceWidth = WIDTH * 1.0 / timeBufferLength;
		var x = 0;

		for (i = 0; i < timeBufferLength; i++) {

			var v = timeArray[i] / 128.0;
			var y = v * HEIGHT/2;

			if (i === 0) {
			  tPlayer.canvasCtx.moveTo(x, y);
			} else {
			  tPlayer.canvasCtx.lineTo(x, y);
			}

			x += sliceWidth;
		}

		tPlayer.canvasCtx.lineTo(WIDTH, HEIGHT/2);
		tPlayer.canvasCtx.stroke();




		
	},

	events: {
		onEnded: function(e){
			console.log("onEnded", e);
			window.cancelAnimationFrame(tPlayer.animationFrame);
		}
	}

}