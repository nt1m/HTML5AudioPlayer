var AudioPlayer = {
    "init": function() {
        this.audioEl = document.getElementById("AudioPlayer");
        this.uploadEl = document.getElementById("upfile");
        this.headerEl = document.getElementById("header");

        this.playPauseEl = document.getElementById("play-pause");
        this.volumeIcon = document.getElementById("volume-icon");
        this.loopEl = document.getElementById("loop");
        this.speedBtnEl = document.getElementById("speed-btn");

        this.progressBar = document.getElementById("progress-bar");
        this.progressEl = document.getElementById("progress");
        this.tooltipEl = document.getElementById("tooltip");

        this.sidebarEl = document.getElementById("sidebar");
        this.playlistEl = document.getElementById("playlist");
        this.controlsEl = document.getElementById("audio-controls");
        this.canvasEl = document.getElementById("visualizer");

        this.uploadFiles = this.uploadFiles.bind(this);

        this.uploadEl.addEventListener("change", AudioPlayer.uploadFiles);
        this.sidebarEl.addEventListener("dragenter",function () {
            AudioPlayer.sidebarEl.classList.remove("no-drag");
            AudioPlayer.sidebarEl.classList.add("drag");
        });
        this.sidebarEl.addEventListener("dragleave",function () {
            AudioPlayer.sidebarEl.classList.remove("drag");
            AudioPlayer.sidebarEl.classList.add("no-drag");
        });
        this.sidebarEl.addEventListener("dragover",function (e) {
            e.preventDefault();
            e.stopPropagation();
        });
        this.sidebarEl.addEventListener("drop",function (e) {
            e.preventDefault();
            e.stopPropagation();
            AudioPlayer.uploadFiles(e.dataTransfer.files);
            AudioPlayer.sidebarEl.classList.remove("drag");
            AudioPlayer.sidebarEl.classList.add("no-drag");
        });
        
        this.progressBar.addEventListener("mousedown", function(e) {
            AudioPlayer.onProgressClick(e.pageX);
        });
        this.progressBar.addEventListener("mouseover", function(e) {
            AudioPlayer.setProgressTooltip(e.pageX);
        });
        
        this.audioEl.addEventListener("timeupdate", function() {
            AudioPlayer.updateProgressBar();
            AudioPlayer.tooltipEl.innerHTML = AudioPlayer.getTooltip(this.currentTime);
        });
        this.audioEl.addEventListener("play", function() {
            AudioPlayer.playPauseEl.classList.remove("paused");

            if(!AudioPlayer.playlistEl.querySelector(".playing") && AudioPlayer.playlistEl.querySelector(".last-played") !== null) {
                AudioPlayer.playlistEl.querySelector(".last-played").className = "playing";
            }
        });
        this.audioEl.addEventListener("pause", function() {
            AudioPlayer.playPauseEl.classList.add("paused");
        });
        this.audioEl.addEventListener("ended", function() {
            AudioPlayer.killContext();
            var playing = AudioPlayer.playlistEl.querySelector(".playing");
            if(playing.nextSibling==null)
                playing.parentElement.children[0].click();
            else
                playing.nextSibling.click();
        });
        this.initAudioContext();    },
    initAudioContext: function() {
        var ctx = new AudioContext();
        var audio = this.audioEl;
        var audioSrc = ctx.createMediaElementSource(audio);
        var analyser = ctx.createAnalyser();
        audioSrc.connect(analyser);
        analyser.connect(ctx.destination);
        this.analyser = analyser;
        this.ctx = ctx;
    },
    get paused() {
        return this.audioEl.paused;
    },
    "play": function() {
        this.audioEl.play();
        AudioPlayer.recordContext();
        this.canvasEl.classList.remove("placeholder");
    },
    
    "pause": function() {
        this.audioEl.pause();
        this.canvasEl.classList.add("placeholder playing");
    },
    "stop": function() {
        this.audioEl.pause();
        this.audioEl.currentTime = 0;
        this.canvasEl.classList.add("placeholder playing");
    },
    "fastrewind": function() {
        this.audioEl.currentTime -= 5;
    },
    "fastforward": function() {
        this.audioEl.currentTime += 5;
    },
    "playlist":[],
    "addItemAsync":function (data,lastfile) {
        /* For more informations https://en.wikipedia.org/wiki/ID3#Layout */
        var fr = new FileReader();
        fr.readAsArrayBuffer(data);
        fr.onload=function(e){
            var result = e.target.result;
            /* Getting the last 128 bytes of the Array buffer */
            result = result.slice(result.byteLength-128);
            /* Converting the ArrayBuffer to String */
            result = new Uint8Array(result);
            result = String.fromCharCode.apply(null,result);
            var tags = {};
            if (result.slice(0,4)=="TAG+"){// Extended id3v1 tag
                tags = {
                    "title" : result.slice(4,64).replace(/[\0]/g,""),
                    "artist" : result.slice(64,124).replace(/[\0]/g,""),
                    "album" : result.slice(124,184).replace(/[\0]/g,""),
                    "speed_list" : ["unset","slow","medium","fast","hardcore"],
                    "speed":this.speed_list[parseInt(result.slice(184,185))],
                    "genre":result.slice(185,215).replace(/[\0]/g,""),
                    "start-time":result.slice(215,221).replace(/[\0]/g,""),
                    "end-time":result.slice(221,227).replace(/[\0]/g,"")
                };
            
            }else if(result.slice(0,3).replace(/[\0]/g,"")=="TAG"){ // Basic id3v1 tag
                tags = {
                    "title" : result.slice(3,3+30).replace(/[\0]/g,""),
                    "artist" : result.slice(30+3,2*30+3).replace(/[\0]/g,""),
                    "album" : result.slice(2*30+3,3*30+3).replace(/[\0]/g,""),
                    "year" : result.slice(3*30+3,3*30+7).replace(/[\0]/g,""),
                    "comment" : result.slice(3*30+7,4*30+7).replace(/[\0]/g,"")
                };
            }
            var it = {"file":data,"tags":tags};
            //(AudioPlayer.playlist.length-1>0) && console.log(AudioPlayer.playlist[AudioPlayer.playlist.length-1].file.name)
            AudioPlayer.playlist[AudioPlayer.playlist.length] = it;
            AudioPlayer.createPlaylistItem(AudioPlayer.playlist.length-1,tags);
            if(lastfile){
                AudioPlayer.setAudio(AudioPlayer.playlist[0].file);
                AudioPlayer.controlsEl.classList.remove("disabled");
            }
        } ;
    },
    "createPlaylistItem": function(key,tags) {
        var data = AudioPlayer.playlist[key].file
        var titleValue = (tags.title !== undefined) && tags.title || this.extractNameFromFile(data);
        var playlist = AudioPlayer.playlistEl;
        var item = document.createElement("li");
        item.setAttribute("playlist-key",key);
        var title = document.createElement("p");
        title.className = "title";
        title.innerHTML = titleValue;
        var cross = document.createElement("span");
        cross.className = "cross";
        title.appendChild(cross);
        item.appendChild(title);
        item.data = data;
        item.title = titleValue;
        item.addEventListener("click", function(e) {
            if(e.target.className!="cross")
                AudioPlayer.setAudio(this.data);
            else
                AudioPlayer.removeItem(e.target.parentElement.parentElement);
        });
        playlist.appendChild(item);
        return item;
    },
    "removeItem": function(li) {
        var key;
        for (var i in li.parentElement.children) {
            if (li.parentElement.children.hasOwnProperty(key)) {
                var element = li.parentElement.children[key];
                if(element == li)
                    key = i;                
            }
        }
        li.remove();
        this.playlist.pop(key);
        if(li.classList.contains("playing")){
            if(this.playlist.length<=0){
                this.stop();
                this.audioEl.removeAttribute("src");
                this.controlsEl.classList.add("disabled");
                this.setAudio(this.playlist[this.playlist.length-1].file);
            }else{
                this.setAudio(this.playlist[this.playlist.length-1].file);
            }    
        }
    },
    "uploadFiles": function(files) {
        var uploadedMusic = this.uploadEl.files || files;
        this.playlistEl.classList.add("Loading");
        for (var i = 0; i < uploadedMusic.length; i++) {
            if(uploadedMusic[i].type.match("audio")=="audio"){
                var music = uploadedMusic[i];
                var add = 0;
                for (var k in this.playlist) {
                    var fn = this.playlist[k].name;
                    if(music.name==fn){
                        add+=1;
                    }
                }
                if(add==0){
                    this.addItemAsync(music,(uploadedMusic.length-1==i));
                }
            }else
                return false;
        }
        this.playlistEl.classList.remove("Loading");
        return true;
    },
    "setAudio": function(music) {
        var key = 0;
        for(var i=0 ; i<this.playlist.length;i++){
            if(this.playlist[i].file.name==music.name){
                key = i;
                break;
            }
        }
        var audio = window.URL.createObjectURL(music);
        this.audioEl.src = audio;
        this.headerEl.innerHTML = (this.playlist[key].tags.title !== undefined) && 
            (this.playlist[key].tags.title + " | " + this.playlist[key].tags.artist) || this.extractNameFromFile(music);
        document.title = this.headerEl.innerHTML;
        var items = this.playlistEl.children;

        for(i in items) {
            if (items.hasOwnProperty(i)) {
                items[i].classList.remove("playing");
                if(items[i].getAttribute("playlist-key") ==key){
                    console.log(key);
                    items[i].classList.add("playing");
                    
                }
            }
        }
        this.play();
    },
    "toggleLoop": function() {
        if(this.audioEl.loop) {
            this.audioEl.loop = false;
            this.loopEl.classList.remove("checked");
        }
        else {
            this.audioEl.loop = true;
            this.loopEl.classList.add("checked");
        }
    },
    "toggleSpeedBtn": function() {
        if(this.speedBtnEl.classList.contains("checked")){
            this.speedBtnEl.classList.remove("checked");
            this.speedBtnEl.classList.add("not-checked");
        }else{
            this.speedBtnEl.classList.remove("not-checked");
            this.speedBtnEl.classList.add("checked");
        }
    },
    "changeVolume": function(volume) {
        this.audioEl.volume = volume;
        if(volume == 0) {
            this.volumeIcon.className = "mute";
        }
        else if(volume <= 0.5) {
            this.volumeIcon.className = "half";
        }
        else {
            this.volumeIcon.className = "";
        }
    },
    "changeSpeed": function(value) {
        var values = [0.5,1,1.25,1.5,2,4];
        this.audioEl.playbackRate = values[value];
    },
    "updateProgressBar": function() {
        var width = (this.audioEl.currentTime * document.body.clientWidth) / this.audioEl.duration;
        this.progressEl.style.width = width + "px";
    },
    "onProgressClick": function(x) {
        var duration = (x * this.audioEl.duration) / document.body.clientWidth;
        this.setCurrentTime(duration);
    },
    "setProgressTooltip": function(x) {
        var duration = (x * this.audioEl.duration) / document.body.clientWidth;
        this.progressBar.title = this.getTooltip(duration);
    },
    "getTooltip": function(time) {
        var data = this.convertSecondsToDisplay(time);
        var display = "";
        if(data.hours !== 0) {
            display = data.hours;
        }
        if(data.minutes < 10) {
            data.minutes = "0" + data.minutes;
        }
        if(data.seconds < 10) {
            data.seconds = "0" + data.seconds;
        }
        display = display + data.minutes + ":" + data.seconds;
        return display;
    },
    "convertSecondsToDisplay": function(time) {
        var hours = Math.floor(time / 3600);
        time = time - hours * 3600;
        var minutes = Math.floor(time / 60);
        var seconds = Math.floor(time - minutes * 60);
        return {hours: hours, minutes: minutes, seconds: seconds};
    },
    "recordContext": function() {
        this.visualize(this.analyser);
    },
    "killContext": function() {
        var canvas = this.canvasEl;
        var ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    },
    "visualize": function(analyser) {
        var that = this,
            canvas = this.canvasEl,
            cwidth = canvas.width,
            cheight = canvas.height - 2,
            meterWidth = 10,
            capHeight = 2,
            capStyle = "#fff",
            meterNum = 800 / (10 + 2),
            capYPositionArray = [],
            ctx = canvas.getContext("2d");
        var drawMeter = function() {
            var array = new Uint8Array(analyser.frequencyBinCount);
            analyser.getByteFrequencyData(array);
            if (that.status === 0) {
                for (var i = array.length - 1; i >= 0; i--) {
                    array[i] = 0;
                }
                var allCapsReachBottom = true;
                for (i = capYPositionArray.length - 1; i >= 0; i--) {
                    allCapsReachBottom = allCapsReachBottom && (capYPositionArray[i] === 0);
                }
                if (allCapsReachBottom) {
                    cancelAnimationFrame(that.animationId);
                    return;
                }
            }
            var step = Math.round(array.length / meterNum);
            ctx.clearRect(0, 0, cwidth, cheight);
            for (i = 0; i < meterNum; i++) {
                var value = array[i * step];
                if (capYPositionArray.length < Math.round(meterNum)) {
                    capYPositionArray.push(value);
                }
                ctx.fillStyle = capStyle;
                if (value < capYPositionArray[i]) {
                    ctx.fillRect(i * 12, cheight - (--capYPositionArray[i]), meterWidth, capHeight);
                } else {
                    ctx.fillRect(i * 12, cheight - value, meterWidth, capHeight);
                    capYPositionArray[i] = value;
                }
                ctx.fillStyle = "#0095dd";
                ctx.fillRect(i * 12, cheight - value + capHeight, meterWidth, cheight);
            }
            that.animationId = requestAnimationFrame(drawMeter);
        };
        this.animationId = requestAnimationFrame(drawMeter);
    },
    "setCurrentTime": function(time) {
        this.audioEl.currentTime = time;
    },
    "extractNameFromFile": function(file) {
        var t = file.name.split(".");
        return t.slice(0,t.length-1).join(".");
    }
};

window.addEventListener("load", function() {
    AudioPlayer.init();
}, false);
