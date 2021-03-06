

var easyrtc = {};

//
// for supporting internationalization
//
easyrtc.format = function() {
    var formatted = arguments[0];
    for (var i = 1; i < arguments.length; i++) {
        var regexp = new RegExp('\\{' + (i - 1) + '\\}', 'gi');
        formatted = formatted.replace(regexp, arguments[i]);
    }
    return formatted;
};

/** @private
 * @param {Object} destObject
 * @param {Object} allowedEventsArray
 */
var easyrtcAddEventHandling = function(destObject, allowedEventsArray) {
    var i;
    //
    // build a dictionary of allowed events for this object.
    //
    var allowedEvents = {};
    for (i = 0; i < allowedEventsArray.length; i++) {
        allowedEvents[allowedEventsArray[i]] = true;
    }
    //
    // verify that the eventName argument is a valid event type for the object.
    //
    function eventChecker(eventName, src) {
        if (typeof eventName !== 'string') {
            easyrtc.showError(easyrtc.errCodes.DEVELOPER_ERR, src + " called without a string as the first argument");
            throw "developer error";
        }
        if (!allowedEvents[eventName]) {
            easyrtc.showError(easyrtc.errCodes.DEVELOPER_ERR, src + " called with a bad event name = " + eventName);
            throw "developer error";
        }
    }
    var eventListeners = {};
    destObject.addEventListener = function(eventName, eventListener) {
        eventChecker(eventName, "addEventListener");
        if (typeof eventListener !== 'function') {
            easyrtc.showError(easyrtc.errCodes.DEVELOPER_ERR, "addEventListener called with a nonfunction for second argument");
            throw "developer error";
        }
        //
        // remove the event listener if it's already present so we don't end up with two copies
        //
        destObject.removeEventListener(eventName, eventListener);
        if (!eventListeners[eventName]) {
            eventListeners[eventName] = [];
        }
        eventListeners[eventName][eventListeners[eventName].length] = eventListener;
    };
    destObject.removeEventListener = function(eventName, eventListener) {
        eventChecker(eventName, "removeEventListener");
        var listeners = eventListeners[eventName];
        var i = 0;
        if (listeners) {
            for (i = 0; i < listeners.length; i++) {
                if (listeners[i] === eventListener) {
                    if (i < listeners.length - 1) {
                        listeners[i] = listeners[listeners.length - 1];
                    }
                    listeners.length = listeners.length - 1;
                }
            }
        }
    };
    destObject.emitEvent = function(eventName, eventData) {
        eventChecker(eventName, "emitEvent");
        var listeners = eventListeners[eventName];
        var i = 0;
        if (listeners) {
            for (i = 0; i < listeners.length; i++) {
                listeners[i](eventName, eventData);
            }
        }
    };
};

easyrtcAddEventHandling(easyrtc, ["roomOccupant"]); // i'm amine 

/** Error codes that the EasyRTC will use in the errorCode field of error object passed
 *  to error handler set by easyrtc.setOnError. The error codes are short printable strings.
 * @type Dictionary
 */
easyrtc.errCodes = {
    BAD_NAME: "BAD_NAME", // a user name wasn't of the desired form
    CALL_ERR: "CALL_ERR", // something went wrong creating the peer connection
    DEVELOPER_ERR: "DEVELOPER_ERR", // the developer using the EasyRTC library made a mistake
    SYSTEM_ERR: "SYSTEM_ERR", // probably an error related to the network
    CONNECT_ERR: "CONNECT_ERR", // error occurred when trying to create a connection
    MEDIA_ERR: "MEDIA_ERR", // unable to get the local media
    MEDIA_WARNING: "MEDIA_WARNING", // didn't get the desired resolution
    INTERNAL_ERR: "INTERNAL_ERR",
    PEER_GONE: "PEER_GONE", // peer doesn't exist
    ALREADY_CONNECTED: "ALREADY_CONNECTED"
};
easyrtc.apiVersion = "1.0.10";
/** Most basic message acknowledgment object */
easyrtc.ackMessage = {msgType: "ack", msgData: {}};
/** Regular expression pattern for user ids. This will need modification to support non US character sets */
easyrtc.usernameRegExp = /^(.){1,64}$/;
/** @private */
easyrtc.cookieId = "easyrtcsid";
/** @private */
easyrtc.username = null;
/** @private */
easyrtc.loggingOut = false;
/** @private */
easyrtc.disconnecting = false;
/** @private */
easyrtc.localStream = null;
/** @private */
easyrtc.videoFeatures = true; // default video
easyrtc.audioFeatures = true; // default audio

/** @private */
easyrtc.audioEnabled = true;

/** @private */
easyrtc.videoEnabled = true;
/** @private */
easyrtc.forwardStreamEnabled = false;
/** @private */
easyrtc.datachannelName = "dc";
/** @private */
easyrtc.debugPrinter = null;
/** Your easyrtcid */
easyrtc.myEasyrtcid = "";
/** @private */
easyrtc.oldConfig = {};
/** @private */
easyrtc.offersPending = {};
/** @private */
//easyrtc.selfRoomJoinTime = 0;




/** Checks if the supplied string is a valid user name (standard identifier rules)
 * @param {String} name
 * @return {Boolean} true for a valid user name
 * @example
 *    var name = document.getElementById('nameField').value;
 *    if( !easyrtc.isNameValid(name)){
 *        console.error("Bad user name");
 *    }
 */
easyrtc.isNameValid = function(name) {
    return easyrtc.usernameRegExp.test(name);
};






/** Enable or disable logging to the console.
 * Note: if you want to control the printing of debug messages, override the
 *    easyrtc.debugPrinter variable with a function that takes a message string as it's argument.
 *    This is exactly what easyrtc.enableDebug does when it's enable argument is true.
 * @param {Boolean} enable - true to turn on debugging, false to turn off debugging. Default is false.
 * @example
 *    easyrtc.enableDebug(true);
 */
easyrtc.enableDebug = function(enable) {
    if (enable) {
        easyrtc.debugPrinter = function(message) {
            var stackString = new Error().stack;
            var srcLine = "location unknown";
            if (stackString) {
                var stackFrameStrings = new Error().stack.split('\n');
                srcLine = "";
                if (stackFrameStrings.length >= 3) {
                    srcLine = stackFrameStrings[2];
                }
            }
            console.log("debug " + (new Date()).toISOString() + " : " + message + " [" + srcLine + "]");
        };
    }
    else {
        easyrtc.debugPrinter = null;
    }
};

//
// this is a temporary version used until we connect to the server.
//
easyrtc.updatePresence = function(state, statusText) {
    easyrtc.presenceShow = state;
    easyrtc.presenceStatus = statusText;
};

/**
 * Determines if the local browser supports WebRTC GetUserMedia (access to camera and microphone).
 * @returns {Boolean} True getUserMedia is supported.
 */
easyrtc.supportsGetUserMedia = function() {
    return !!getUserMedia;
};
/**
 * Determines if the local browser supports WebRTC Peer connections to the extent of being able to do video chats.
 * @returns {Boolean} True if Peer connections are supported.
 */
easyrtc.supportsPeerConnections = function() {
    if (!easyrtc.supportsGetUserMedia()) {
        return false;
    }
    if (!window.RTCPeerConnection) {
        return false;
    }
    try {
        easyrtc.createRTCPeerConnection({"iceServers": []}, null);
    } catch (oops) {
        return false;
    }
    return true;
};
/** @private
 * @param pc_config ice configuration array
 * @param optionalStuff peer constraints.
 */
/** @private
 * @param pc_config ice configuration array
 * @param optionalStuff peer constraints.
 */
easyrtc.createRTCPeerConnection = function(pc_config, optionalStuff) {
    if (RTCPeerConnection) {
        return new RTCPeerConnection(pc_config, optionalStuff);
    }
    else {
        throw "Your browser doesn't support webRTC (RTCPeerConnection)";
    }
};
//
// this should really be part of adapter.js
// Versions of chrome < 31 don't support reliable data channels transport.
// Firefox does.
//
easyrtc.getDatachannelConstraints = function() {
    if (webrtcDetectedBrowser === "chrome" && webrtcDetectedVersion < 31) {
        return {reliable: false};
    }
    else {
        return {reliable: true};
    }
};
/** @private */
easyrtc.haveAudioVideo = {
    audio: false,
    video: false
};
/** @private */
easyrtc.dataEnabled = false;
/** @private */
easyrtc.serverPath = null;
/** @private */
easyrtc.roomOccupantListener = null;
/** @private */
easyrtc.onDataChannelOpen = null;
/** @private */
easyrtc.onDataChannelClose = null;
/** @private */
easyrtc.lastLoggedInList = {};
/** @private */
easyrtc.receivePeer = {msgTypes: {}};
/** @private */
easyrtc.receiveServerCB = null;
/** @private */
easyrtc.updateConfigurationInfo = function() {

}; // dummy placeholder for when we aren't connected
//
//
//  easyrtc.peerConns is a map from caller names to the below object structure
//     {  startedAV: boolean,  -- true if we have traded audio/video streams
//        dataChannelS: RTPDataChannel for outgoing messages if present
//        dataChannelR: RTPDataChannel for incoming messages if present
//        dataChannelReady: true if the data channel can be used for sending yet
//        dataChannelWorks: true if the data channel has been tested and found to work.
//        connectTime: timestamp when the connection was started
//        sharingAudio: true if audio is being shared
//        sharingVideo: true if video is being shared
//        cancelled: temporarily true if a connection was cancelled by the peer asking to initiate it.
//        candidatesToSend: SDP candidates temporarily queued
//        pc: RTCPeerConnection
//        mediaStream: mediaStream
//     function callSuccessCB(string) - see the easyrtc.call documentation.
//        function callFailureCB(errorCode, string) - see the easyrtc.call documentation.
//        function wasAcceptedCB(boolean,string) - see the easyrtc.call documentation.
//     }
//
/** @private */
easyrtc.peerConns = {};
//
// a map keeping track of whom we've requested a call with so we don't try to
// call them a second time before they've responded.
//
/** @private */
easyrtc.acceptancePending = {};
/*
 * the maximum length of the apiFields. This is defined on the
 * server side as well, so changing it here alone is insufficient.
 */
/** @private */
var maxApiFieldsLength = 128;
/**
 * Disconnect from the EasyRTC server.
 * @example
 *    easyrtc.disconnect();
 */
easyrtc.disconnect = function() {
};
/** @private
 * @param caller
 * @param helper
 */
easyrtc.acceptCheck = function(caller, helper) {
    helper(true);
};
/** @private
 * @param easyrtcid
 * @param stream
 */
easyrtc.streamAcceptor = function(easyrtcid, stream) {
};
/** @private
 * @param easyrtcid
 */
easyrtc.onStreamClosed = function(easyrtcid) {
};
/** @private
 * @param easyrtcid
 */
easyrtc.callCancelled = function(easyrtcid) {
};

/** Default error reporting function. The default implementation displays error messages
 *  in a programmatically created div with the id easyrtcErrorDialog. The div has title
 *  component with a class name of easyrtcErrorDialog_title. The error messages get added to a
 *  container with the id easyrtcErrorDialog_body. Each error message is a text node inside a div
 *  with a class of easyrtcErrorDialog_element. There is an "okay" button with the className of easyrtcErrorDialog_okayButton.
 *  @param {String} messageCode An error message code
 *  @param {String} message the error message text without any markup.
 *  @example
 *      easyrtc.showError("BAD_NAME", "Invalid username");
 */
easyrtc.showError = function(messageCode, message) {
    easyrtc.onError({errorCode: messageCode, errorText: message});
};
/** @private
 * @param errorObject
 */
easyrtc.onError = function(errorObject) {
    if (easyrtc.debugPrinter) {
        easyrtc.debugPrinter("saw error " + errorObject.errorText);
    }
    var errorDiv = document.getElementById('easyrtcErrorDialog');
    var errorBody;
    if (!errorDiv) {
        errorDiv = document.createElement("div");
        errorDiv.id = 'easyrtcErrorDialog';
        var title = document.createElement("div");
        title.innerHTML = "Error messages";
        title.className = "easyrtcErrorDialog_title";
        errorDiv.appendChild(title);
        errorBody = document.createElement("div");
        errorBody.id = "easyrtcErrorDialog_body";
        errorDiv.appendChild(errorBody);
        var clearButton = document.createElement("button");
        clearButton.appendChild(document.createTextNode("Okay"));
        clearButton.className = "easyrtcErrorDialog_okayButton";
        clearButton.onclick = function() {
            errorBody.innerHTML = ""; // remove all inner nodes
            errorDiv.style.display = "none";
        };
        errorDiv.appendChild(clearButton);
        document.body.appendChild(errorDiv);
    }

    errorBody = document.getElementById("easyrtcErrorDialog_body");
    var messageNode = document.createElement("div");
    messageNode.className = 'easyrtcErrorDialog_element';
    messageNode.appendChild(document.createTextNode(errorObject.errorText));
    errorBody.appendChild(messageNode);
    errorDiv.style.display = "block";
};

/** @private */
easyrtc.videoBandwidthString = "b=AS:50"; // default video band width is 50kbps

/**
 * A convenience function to ensure that a string doesn't have symbols that will be interpreted by HTML.
 * @param {String} idString
 * @return {String} The cleaned string.
 * @example
 *     console.log( easyrtc.cleanId('&hello'));
 */
easyrtc.cleanId = function(idString) {
    var MAP = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;'
    };
    return idString.replace(/[&<>]/g, function(c) {
        return MAP[c];
    });
};

/** Set the callback that will be invoked when the list of people logged in changes.
 * The callback expects to receive a room name argument, and
 *  a map whose ideas are easyrtcids and whose values are in turn maps
 * supplying user specific information. The inner maps have the following keys:
 *  username, applicationName, browserFamily, browserMajor, osFamily, osMajor, deviceFamily.
 *  The third argument is the listener is the innerMap for the connections own data (not needed by most applications).
 * @param {Function} listener
 * @example
 *   easyrtc.setRoomOccupantListener( function(roomName, list, selfInfo){
 *      for( var i in list ){
 *         ("easyrtcid=" + i + " belongs to user " + list[i].username);
 *      }
 *   });
 */
easyrtc.setRoomOccupantListener = function(listener) {
    easyrtc.roomOccupantListener = listener;
};

/**
 * Returns a media stream for your local camera and microphone.
 *  It can be called only after easyrtc.initMediaSource has succeeded.
 *  It returns a stream that can be used as an argument to easyrtc.setVideoObjectSrc.
 * @return {MediaStream}
 * @example
 *    easyrtc.setVideoObjectSrc( document.getElementById("myVideo"), easyrtc.getLocalStream());
 */
easyrtc.getLocalStream = function() {
    return easyrtc.localStream;
};
/** Clears the media stream on a video object.
 *
 * @param {DomElement} element the video object.
 * @example
 *    easyrtc.clearMediaStream( document.getElementById('selfVideo'));
 *
 */
easyrtc.clearMediaStream = function(element) {
    if (typeof element.srcObject !== 'undefined') {
        element.srcObject = null;
    } else if (typeof element.mozSrcObject !== 'undefined') {
        element.mozSrcObject = null;
    } else if (typeof element.src !== 'undefined') {
        element.src = null;
    } else {
    }
};
/**
 *  Sets a video or audio object from a media stream.
 *  Chrome uses the src attribute and expects a URL, while firefox
 *  uses the mozSrcObject and expects a stream. This procedure hides
 *  that from you.
 *  If the media stream is from a local webcam, you may want to add the
 *  easyrtcMirror class to the video object so it looks like a proper mirror.
 *  The easyrtcMirror class is defined in easyrtc.css.
 *  Which is could be added using the same path of easyrtc.js file to an HTML file
 *  @param {DOMObject} videoObject an HTML5 video object
 *  @param {MediaStream} stream a media stream as returned by easyrtc.getLocalStream or your stream acceptor.
 * @example
 *    easyrtc.setVideoObjectSrc( document.getElementById("myVideo"), easyrtc.getLocalStream());
 *
 */
easyrtc.setVideoObjectSrc = function(videoObject, stream) {
    if (stream && stream !== "") {
        videoObject.autoplay = true;
        attachMediaStream(videoObject, stream);
        videoObject.play();
    }
    else {
        easyrtc.clearMediaStream(videoObject);
    }
};


/** Initializes your access to a local camera and microphone.
 *  Failure could be caused a browser that didn't support WebRTC, or by the user
 * not granting permission.
 * If you are going to call easyrtc.enableAudio or easyrtc.enableVideo, you need to do it before
 * calling easyrtc.initMediaSource.
 * @param {Function} successCallback - will be called when the media source is ready.
 * @param {Function} errorCallback - is called with a message string if the attempt to get media failed.
 * @example
 *       easyrtc.initMediaSource(
 *          function(){
 *              easyrtc.setVideoObjectSrc( document.getElementById("mirrorVideo"), easyrtc.getLocalStream());
 *          },
 *          function(){
 *               easyrtc.showError("no-media", "Unable to get local media");
 *          });
 *
 */
easyrtc.initMediaSource = function(successCallback, errorCallback) {

    if (easyrtc.debugPrinter) {
        easyrtc.debugPrinter("about to request local media");
    }

    if (!window.getUserMedia) {
        errorCallback("Your browser doesn't appear to support WebRTC.");
    }

    if (errorCallback === null) {
        errorCallback = function(errorCode, errorText) {
            var message = "easyrtc.initMediaSource: " + easyrtc.formatError(errorText);
            if (easyrtc.debugPrinter) {
                easyrtc.debugPrinter(message);
            }
            easyrtc.showError(easyrtc.errCodes.MEDIA_ERR, message);
        };
    }

    if (!successCallback) {
        console.error("easyrtc.initMediaSource not supplied a successCallback");
        return;
    }


    var mode = {'audio': (easyrtc.audioEnabled ? easyrtc.audioFeatures : false),
        'video': ((easyrtc.videoEnabled) ? (easyrtc.videoFeatures) : false)};

    if (easyrtc.videoEnabled && easyrtc.videoFeatures && easyrtc.videoFeatures.mandatory &&
            easyrtc.videoFeatures.mandatory.chromeMediaSource === "screen") {
        if (mode.audio) {
            mode.audio = false;
            easyrtc.showError(easyrtc.errCodes.DEVELOPER_ERR,
                    "You can't have audio with a screen share. Masking your audio.");
        }
    }
    /** @private
     * @param {Stream} stream
     *  */
    var onUserMediaSuccess = function(stream) {
        if (easyrtc.debugPrinter) {
            easyrtc.debugPrinter("getUserMedia success callback entered");
        }


        if (easyrtc.debugPrinter) {
            easyrtc.debugPrinter("successfully got local media");
        }
        easyrtc.localStream = stream;
        var videoObj, triesLeft, tryToGetSize, ele;
        if (easyrtc.haveAudioVideo.video) {
            videoObj = document.createElement('video');
            videoObj.muted = true;
            triesLeft = 30;
            tryToGetSize = function() {
                if (videoObj.videoWidth > 0 || triesLeft < 0) {
                    easyrtc.nativeVideoWidth = videoObj.videoWidth;
                    easyrtc.nativeVideoHeight = videoObj.videoHeight;
                    if (easyrtc.videoFeatures.mandatory &&
                            easyrtc.videoFeatures.mandatory.minHeight &&
                            (easyrtc.nativeVideoHeight !== easyrtc.videoFeatures.mandatory.minHeight ||
                                    easyrtc.nativeVideoWidth !== easyrtc.videoFeatures.mandatory.minWidth)) {
                        easyrtc.showError(easyrtc.errCodes.MEDIA_WARNING,
                                easyrtc.format(easyrtc.constantStrings.resolutionWarning,
                                easyrtc.videoFeatures.mandatory.minWidth, easyrtc.videoFeatures.mandatory.minHeight,
                                easyrtc.nativeVideoWidth, easyrtc.nativeVideoHeight));
                    }
                    easyrtc.setVideoObjectSrc(videoObj, "");
                    if (videoObj.removeNode) {
                        videoObj.removeNode(true);
                    }
                    else {
                        ele = document.createElement('div');
                        ele.appendChild(videoObj);
                        ele.removeChild(videoObj);
                    }

                    easyrtc.updateConfigurationInfo();
                    if (successCallback) {
                        successCallback();
                    }
                }
                else {
                    triesLeft -= 1;
                    setTimeout(tryToGetSize, 100);
                }
            };
            easyrtc.setVideoObjectSrc(videoObj, stream);
            tryToGetSize();
        }
        else {
            easyrtc.updateConfigurationInfo();
            if (successCallback) {
                successCallback();
            }
        }
    };
	
    /** @private
     * @param {String} error
     */
    var onUserMediaError = function(error) {
        console.log("getusermedia failed");
        if (easyrtc.debugPrinter) {
            easyrtc.debugPrinter("failed to get local media");
        }
        if (errorCallback) {
            errorCallback(easyrtc.errCodes.MEDIA_ERR, "Failed to get access to local media. Error code was " + error.code + ".");
        }
        easyrtc.localStream = null;
        easyrtc.haveAudioVideo = {
            audio: false,
            video: false
        };
        easyrtc.updateConfigurationInfo();
    };
    if (!easyrtc.audioEnabled && !easyrtc.videoEnabled) {
        onUserMediaError("At least one of audio and video must be provided");
        return;
    }

    /** @private */
    easyrtc.haveAudioVideo = {
        audio: easyrtc.audioEnabled,
        video: easyrtc.videoEnabled
    };

    function getCurrentTime() {
        return (new Date()).getTime();
    }

    var firstCallTime;
    if (easyrtc.videoEnabled || easyrtc.audioEnabled) {
        //
        // getUserMedia sopm fails the first time I call it. I suspect it's a page loading
        // issue. So I'm going to try adding a 3 second delay to allow things to settle down first.
        // In addition, I'm going to try again after 3 seconds.
        //

        function tryAgain(error) {
            var currentTime = getCurrentTime();
            if (currentTime < firstCallTime + 1000) {
                console.log("Trying getUserMedia a second time");
                setTimeout(function() {
                    getUserMedia(mode, onUserMediaSuccess, onUserMediaError);
                }, 3000);
            }
            else {
                onUserMediaError(error);
            }
        }

        function tryAgain2(e) {
            console.log("Trying getUserMedia a second time");
            try {
                getUserMedia(mode, onUserMediaSuccess, onUserMediaError);
            }
            catch (e) {
                onUserMediaError(e);
            }
        }

        setTimeout(function() {
            try {
                firstCallTime = getCurrentTime();
                getUserMedia(mode, onUserMediaSuccess, tryAgain);
            } catch (e) {
                setTimeout(tryAgain2, 2500);
            }
        }, 1000);
    }
    else {
        onUserMediaSuccess(null);
    }
};
/**
 * easyrtc.setAcceptChecker sets the callback used to decide whether to accept or reject an incoming call.
 * @param {Function} acceptCheck takes the arguments (callerEasyrtcid, function():boolean ){}
 * The acceptCheck callback is passed (as it's second argument) a function that should be called with either
 * a true value (accept the call) or false value( reject the call).
 * @example
 *      easyrtc.setAcceptChecker( function(easyrtcid, acceptor){
 *           if( easyrtc.idToName(easyrtcid) === 'Fred' ){
 *              acceptor(true);
 *           }
 *           else if( easyrtc.idToName(easyrtcid) === 'Barney' ){
 *              setTimeout( function(){ acceptor(true)}, 10000);
 *           }
 *           else{
 *              acceptor(false);
 *           }
 *      });
 */
easyrtc.setAcceptChecker = function(acceptCheck) {
    easyrtc.acceptCheck = acceptCheck;
};
/**
 * easyrtc.setStreamAcceptor sets a callback to receive media streams from other peers, independent
 * of where the call was initiated (caller or callee).
 * @param {Function} acceptor takes arguments (caller, mediaStream)
 * @example
 *  easyrtc.setStreamAcceptor(function(easyrtcid, stream){easyrtc
 *     document.getElementById('callerName').innerHTML = easyrtc.idToName(easyrtcid);
 *     easyrtc.setVideoObjectSrc( document.getElementById("callerVideo"), stream);
 *  });
 */
easyrtc.setStreamAcceptor = function(acceptor) {
    easyrtc.streamAcceptor = acceptor;
};
/** Sets the easyrtc.onError field to a user specified function.
 * @param {Function} errListener takes an object of the form {errorCode: String, errorText: String}
 * @example
 *    easyrtc.setOnError( function(errorObject){
 *        document.getElementById("errMessageDiv").innerHTML += errorObject.errorText;
 *    });
 */
easyrtc.setOnError = function(errListener) {
    easyrtc.onError = errListener;
};

/**  Sets a callback to receive notification of a media stream closing. The usual
 *  use of this is to clear the source of your video object so you aren't left with
 *  the last frame of the video displayed on it.
 *  @param {Function} onStreamClosed takes an easyrtcid as it's first parameter.
 *  @example
 *     easyrtc.setOnStreamClosed( function(easyrtcid){
 *         easyrtc.setVideoObjectSrc( document.getElementById("callerVideo"), "");
 *         ( easyrtc.idToName(easyrtcid) + " went away");
 *     });
 */
easyrtc.setOnStreamClosed = function(onStreamClosed) {
    easyrtc.onStreamClosed = onStreamClosed;
};
/**
 * Sets the bandwidth for sending video data.
 * Setting the rate too low will cause connection attempts to fail. 40 is probably good lower limit.
 * The default is 50. A value of zero will remove bandwidth limits.
 * @param {Number} kbitsPerSecond is rate in kilobits per second.
 * @example
 *    easyrtc.setVideoBandwidth( 40);
 */
easyrtc.setVideoBandwidth = function(kbitsPerSecond) {
    if (easyrtc.debugPrinter) {
        easyrtc.debugPrinter("video bandwidth set to " + kbitsPerSecond + " kbps");
    }
    if (kbitsPerSecond > 0) {
        easyrtc.videoBandwidthString = "b=AS:" + kbitsPerSecond;
    }
    else {
        easyrtc.videoBandwidthString = "";
    }
};


/**
 * Sets the user name associated with the connection.
 * @param {String} username must obey standard identifier conventions.
 * @returns {Boolean} true if the call succeeded, false if the username was invalid.
 * @example
 *    if( !easyrtc.setUsername("JohnSmith") ){
 *        console.error("bad user name);
 *
 */
easyrtc.setUsername = function(username) {

    if (easyrtc.isNameValid(username)) {
        easyrtc.username = username;
        return true;
    }
    else {
        easyrtc.showError(easyrtc.errCodes.BAD_NAME, easyrtc.format(easyrtc.constantStrings.badUserName, username));
        return false;
    }
};

/**
 * Get an array of easyrtcids that are using a particular username
 * @param {String} username - the username of interest.
 * @param {String} room - an optional room name argument limiting results to a particular room.
 * @returns an array of {easyrtcid:id, roomName: roomName}.
 */
easyrtc.usernameToIds = function(username, room) {
    var results = [];
    var id, roomname;
    for (roomname in easyrtc.lastLoggedInList) {
        if (room && roomname !== room) {
            continue;
        }
        for (id in easyrtc.lastLoggedInList[roomname]) {
            if (easyrtc.lastLoggedInList[roomname][id].username === username) {
                results.push({
                    easyrtcid: id,
                    roomName: roomname
                });
            }
        }
    }
    return results;
};


/**
 * Connects to the EasyRTC signaling server. You must connect before trying to
 * call other users.
 * @param {String} applicationName is a string that identifies the application so that different applications can have different
 *        lists of users. Note that the server configuration specifies a regular expression that is used to check application names 
 *        for validity. The default pattern is that of an identifier, spaces are not allowed.
 * @param {Function} successCallback (easyrtcId, roomOwner) - is called on successful connect. easyrtcId is the
 *   unique name that the client is known to the server by. A client usually only needs it's own easyrtcId for debugging purposes.
 *       roomOwner is true if the user is the owner of a room. It's value is random if the user is in multiple rooms.
 * @param {Function} errorCallback (errorCode, errorText) - is called on unsuccessful connect. if null, an alert is called instead.
 *  The errorCode takes it's value from easyrtc.errCodes.
 * @example
 *   easyrtc.connect("mychat_app",
 *                   function(easyrtcid, roomOwner){
 *                       if( roomOwner){ console.log("I'm the room owner"); }
 *                       console.log("my id is " + easyrtcid);
 *                   },
 *                   function(errorText){
 *                       console.log("failed to connect ", erFrText);
 *                   });
 */
easyrtc.connect = function(applicationName, successCallback, errorCallback) {
    easyrtc.pc_config = {};
    easyrtc.closedChannel = null;
    if (easyrtc.webSocket) {
        console.error("Developer error: attempt to connect when already connected to socket server");
        return;
    }


    easyrtc.fields = {
        rooms: {},
        application: {},
        connection: {}
    };
    if (easyrtc.debugPrinter) {
        easyrtc.debugPrinter("attempt to connect to WebRTC signalling server with application name=" + applicationName);
    }

    function isEmptyObj(obj) {
        if (obj === null || obj === undefined) {
            return true;
        }
        var key;
        for (key in obj) {
            return false;
        }
        return true;
    }
//
// easyrtc.disconnect performs a clean disconnection of the client from the server.
//
    easyrtc.disconnectBody = function() {
        var key;
        easyrtc.loggingOut = true;
        easyrtc.disconnecting = true;
        easyrtc.closedChannel = easyrtc.webSocket;
        if (easyrtc.webSocketConnected) {
            easyrtc.webSocket.close();
            easyrtc.webSocketConnected = false;
        }
        easyrtc.hangupAll();
        if (easyrtc.roomOccupantListener) {
            for (key in easyrtc.lastLoggedInList) {
                easyrtc.roomOccupantListener(key, {}, false);
            }
        }
        easyrtc.emitEvent("roomOccupant", {});
        easyrtc.loggingOut = false;
        easyrtc.disconnecting = false;
        easyrtc.oldConfig = {};
    };
    easyrtc.disconnect = function() {

        if (easyrtc.debugPrinter) {
            easyrtc.debugPrinter("attempt to disconnect from WebRTC signalling server");
        }

        easyrtc.disconnecting = true;
        easyrtc.hangupAll();
        easyrtc.loggingOut = true;

        //
        // The hangupAll may try to send configuration information back to the server.
        // Collecting that information is asynchronous, we don't actually close the
        // connection until it's had a chance to be sent. We allocate 100ms for collecting
        // the info, so 250ms should be sufficient for the disconnecting.
        //
        setTimeout(function() {
            if (easyrtc.webSocket) {
                try {
                    easyrtc.webSocket.disconnect();
                } catch (e) {
                    // we don't really care if this fails.
                }

                easyrtc.closedChannel = easyrtc.webSocket;
                easyrtc.webSocket = 0;
            }
            easyrtc.loggingOut = false;
            easyrtc.disconnecting = false;
            if (easyrtc.roomOccupantListener) {
                easyrtc.roomOccupantListener(null, {}, false);
            }
            easyrtc.emitEvent("roomOccupant", {});
            easyrtc.oldConfig = {};
        }, 250);
    };
    if (errorCallback === null) {
        errorCallback = function(errorCode, errorText) {
            console.error("easyrtc.connect: " + errorText);
        };
    }

    //
    // This function is used to send WebRTC signaling messages to another client. These messages all the form:
    //   destUser: someid or null
    //   msgType: one of ["offer"/"answer"/"candidate","reject","hangup", "getRoomList"]
    //   msgData: either null or an SDP record
    //   successCallback: a function with the signature  function(msgType, wholeMsg);
    //   errorCallback: a function with signature function(errorCode, errorText)
    //
    function sendSignalling(destUser, msgType, msgData, successCallback, errorCallback) {
        if (!easyrtc.webSocket) {
            throw "Attempt to send message without a valid connection to the server.";
        }
        else {
            var dataToShip = {
                msgType: msgType
            };
            if (destUser) {
                dataToShip.targetEasyrtcid = destUser;
            }
            if (msgData) {
                dataToShip.msgData = msgData;
            }

            if (easyrtc.debugPrinter) {
                easyrtc.debugPrinter("sending socket message " + JSON.stringify(dataToShip));
            }
            easyrtc.webSocket.json.emit("easyrtcCmd", dataToShip,
                    function(ackmsg) {
                        if (ackmsg.msgType !== "error") {
                            if (successCallback) {
                                successCallback(ackmsg.msgType, ackmsg.msgData);
                            }
                        }
                        else {
                            if (errorCallback) {
                                errorCallback(ackmsg.msgData.errorCode, ackmsg.msgData.errorText);
                            }
                            else {
                                easyrtc.showError(ackmsg.msgData.errorCode, ackmsg.msgData.errorText);
                            }
                        }
                    }
            );
        }
    }

    easyrtc.sendSignalling = sendSignalling;
    var totalLengthSent = 0;


    /**
     * @private
     */
     easyrtc.buildPeerConstraints = function() {
        var options = [];
        options.push({'DtlsSrtpKeyAgreement': 'true'}); // for interoperability
        return {optional: options};
    };
    /**
     *  Initiates a call to another user. If it succeeds, the streamAcceptor callback will be called.
     * @param {String} otherUser - the easyrtcid of the peer being called.
     * @param {Function} callSuccessCB (otherCaller, mediaType) - is called when the datachannel is established or the mediastream is established. mediaType will have a value of "audiovideo" or "datachannel"
     * @param {Function} callFailureCB (errorCode, errMessage) - is called if there was a system error interfering with the call.
     * @param {Function} wasAcceptedCB (wasAccepted:boolean,otherUser:string) - is called when a call is accepted or rejected by another party. It can be left null.
     * @example
     *    easyrtc.call( otherEasyrtcid,
     *        function(easyrtcid, mediaType){
     *           console.log("Got mediatype " + mediaType + " from " + easyrtc.idToName(easyrtcid));
     *        },
     *        function(errorCode, errMessage){
     *           console.log("call to  " + easyrtc.idToName(otherEasyrtcid) + " failed:" + errMessage);
     *        },
     *        function(wasAccepted, easyrtcid){
     *            if( wasAccepted ){
     *               console.log("call accepted by " + easyrtc.idToName(easyrtcid));
     *            }
     *            else{
     *                console.log("call rejected" + easyrtc.idToName(easyrtcid));
     *            }
     *        });
     */
    easyrtc.call = function(otherUser, callSuccessCB, callFailureCB, wasAcceptedCB) {

        if (easyrtc.debugPrinter) {
            easyrtc.debugPrinter("initiating peer to peer call to " + otherUser +
                    " audio=" + easyrtc.audioEnabled +
                    " video=" + easyrtc.videoEnabled +
                    " data=" + easyrtc.dataEnabled);
        }

        var i, message;
        //
        // If we are sharing audio/video and we haven't allocated the local media stream yet,
        // we'll do so, recalling ourself on success.
        //
        if (easyrtc.localStream === null && (easyrtc.audioEnabled || easyrtc.videoEnabled)) {
            easyrtc.initMediaSource(function() {
                easyrtc.call(otherUser, callSuccessCB, callFailureCB, wasAcceptedCB);
            }, callFailureCB);
            return;
        }

        if (!easyrtc.webSocket) {
            message = "Attempt to make a call prior to connecting to service";
            if (easyrtc.debugPrinter) {
                easyrtc.debugPrinter(message);
            }
            throw message;
        }

        //
        // If B calls A, and then A calls B before accepting, then A should treat the attempt to
        // call B as a positive offer to B's offer.
        //
        if (easyrtc.offersPending[otherUser]) {
            wasAcceptedCB(true);
            doAnswer(otherUser, easyrtc.offersPending[otherUser]);
            delete easyrtc.offersPending[otherUser];
            easyrtc.callCancelled(otherUser, false);
            return;
        }

        // do we already have a pending call?
        if (typeof easyrtc.acceptancePending[otherUser] !== 'undefined') {
            message = "Call already pending acceptance";
            if (easyrtc.debugPrinter) {
                easyrtc.debugPrinter(message);
            }
            callFailureCB(easyrtc.errCodes.ALREADY_CONNECTED, message);
            return;
        }

        easyrtc.acceptancePending[otherUser] = true;
        var pc = buildPeerConnection(otherUser, true, callFailureCB);
        if (!pc) {
            message = "buildPeerConnection failed, call not completed";
            if (easyrtc.debugPrinter) {
                easyrtc.debugPrinter(message);
            }
            throw message;
        }

        easyrtc.peerConns[otherUser].callSuccessCB = callSuccessCB;
        easyrtc.peerConns[otherUser].callFailureCB = callFailureCB;
        easyrtc.peerConns[otherUser].wasAcceptedCB = wasAcceptedCB;
        var peerConnObj = easyrtc.peerConns[otherUser];
        var setLocalAndSendMessage0 = function(sessionDescription) {
            if (peerConnObj.cancelled) {
                return;
            }
            var sendOffer = function() {

                sendSignalling(otherUser, "offer", sessionDescription, null, callFailureCB);
            };
            pc.setLocalDescription(sessionDescription, sendOffer,
                    function(errorText) {
                        callFailureCB(easyrtc.errCodes.CALL_ERR, errorText);
                    });
        };
        setTimeout(function() {
            pc.createOffer(setLocalAndSendMessage0, function(errorObj) {
                callFailureCB(easyrtc.errCodes.CALL_ERR, JSON.stringify(errObj));
            },
                    easyrtc.mediaConstraints);
        }, 100);
    };
 


    function hangupBody(otherUser) {
        if (easyrtc.debugPrinter) {
            easyrtc.debugPrinter("Hanging up on " + otherUser);
        }
        clearQueuedMessages(otherUser);
        if (easyrtc.peerConns[otherUser]) {
            if (easyrtc.peerConns[otherUser].startedAV) {
                try {
                    easyrtc.peerConns[otherUser].pc.close();
                } catch (ignoredError) {
                }

                if (easyrtc.onStreamClosed) {
                    easyrtc.onStreamClosed(otherUser);
                }
            }

            easyrtc.peerConns[otherUser].cancelled = true;
            delete easyrtc.peerConns[otherUser];
            if (easyrtc.webSocket) {
                sendSignalling(otherUser, "hangup", null, function() {
                }, function(errorCode, errorText) {
                    if (easyrtc.debugPrinter) {
                        debugPrinter("hangup failed:" + errorText);
                    }
                });
            }
            if (easyrtc.acceptancePending[otherUser]) {
                delete easyrtc.acceptancePending[otherUser];
            }
        }
    }

    /**
     * Hang up on a particular user or all users.
     *  @param {String} otherUser - the easyrtcid of the person to hang up on.
     *  @example
     *     easyrtc.hangup(someEasyrtcid);
     */
   easyrtc.hangup = function(otherUser) {
        hangupBody(otherUser);
        easyrtc.updateConfigurationInfo();
    };
    /**
     * Hangs up on all current connections.
     * @example
     *    easyrtc.hangupAll();
     */
 
    /** Checks to see if data channels work between two peers.
     * @param {String} otherUser - the other peer.
     * @returns {Boolean} true if data channels work and are ready to be used
     *   between the two peers.
     */
 
    var buildPeerConnection = function(otherUser, isInitiator, failureCB) {
        var pc;
        var message;
        var newPeerConn;

        if (easyrtc.debugPrinter) {
            easyrtc.debugPrinter("building peer connection to " + otherUser);
        }

        //
        // we don't support data channels on chrome versions < 31
        //
        try {
            pc = easyrtc.createRTCPeerConnection(easyrtc.pc_config, easyrtc.buildPeerConstraints());
            if (!pc) {
                message = "Unable to create PeerConnection object, check your ice configuration(" +
                        JSON.stringify(easyrtc.pc_config) + ")";
                if (easyrtc.debugPrinter) {
                    easyrtc.debugPrinter(message);
                }
                throw(message);
            }

            //
            // turn off data channel support if the browser doesn't support it.
            //
         /*   if (easyrtc.dataEnabled && typeof pc.createDataChannel === 'undefined') {
                easyrtc.dataEnabled = false;
            }*/

            pc.onconnection = function() {
                if (easyrtc.debugPrinter) {
                    easyrtc.debugPrinter("onconnection called prematurely");
                }
            };
            newPeerConn = {
                pc: pc,
                candidatesToSend: [],
                startedAV: false,
                isInitiator: isInitiator
            };
            pc.onicecandidate = function(event) {
//                if(easyrtc.debugPrinter){
//                    easyrtc.debugPrinter("saw ice message:\n" + event.candidate);
//                }
                if (newPeerConn.cancelled) {
                    return;
                }
                var candidateData;
                if (event.candidate && easyrtc.peerConns[otherUser]) {
                    candidateData = {
                        type: 'candidate',
                        label: event.candidate.sdpMLineIndex,
                        id: event.candidate.sdpMid,
                        candidate: event.candidate.candidate
                    };

                    //
                    // some candidates include ip addresses of turn servers. we'll want those 
                    // later so we can see if our actual connection uses a turnsever.
                    // The keyword "relay" in the candidate identifies it as referencing a 
                    // turn server. The \d symbol in the regular expression matches a number.
                    // 
                    if (event.candidate.candidate.indexOf("typ relay") > 0) {
                        var ipaddress = event.candidate.candidate.match(/(udp|tcp) \d+ (\d+\.\d+\.\d+\.\d+)/)[2];
                        easyrtc._turnServers[ipaddress] = true;
                    }

                    if (easyrtc.peerConns[otherUser].startedAV) {
                        sendSignalling(otherUser, "candidate", candidateData, null, function() {
                            failureCB(easyrtc.errCodes.PEER_GONE, "Candidate disappeared");
                        });
                    }
                    else {
                        easyrtc.peerConns[otherUser].candidatesToSend.push(candidateData);
                    }
                }
            };
            pc.onaddstream = function(event) {
                if (easyrtc.debugPrinter) {
                    easyrtc.debugPrinter("saw incoming media stream");
                }
                if (newPeerConn.cancelled)
                    return;
                easyrtc.peerConns[otherUser].startedAV = true;
                easyrtc.peerConns[otherUser].sharingAudio = easyrtc.haveAudioVideo.audio;
                easyrtc.peerConns[otherUser].sharingVideo = easyrtc.haveAudioVideo.video;
                easyrtc.peerConns[otherUser].connectTime = new Date().getTime();
                easyrtc.peerConns[otherUser].stream = event.stream;
                if (easyrtc.peerConns[otherUser].callSuccessCB) {
                    if (easyrtc.peerConns[otherUser].sharingAudio || easyrtc.peerConns[otherUser].sharingVideo) {
                        easyrtc.peerConns[otherUser].callSuccessCB(otherUser, "audiovideo");
                    }
                }
                if (easyrtc.audioEnabled || easyrtc.videoEnabled) {
                    updateConfiguration();
                }
                if (easyrtc.streamAcceptor) {
                    easyrtc.streamAcceptor(otherUser, event.stream);
                }
            };
            pc.onremovestream = function(event) {
                if (easyrtc.debugPrinter) {
                    easyrtc.debugPrinter("saw remove on remote media stream");
                }

                if (easyrtc.peerConns[otherUser]) {
                    easyrtc.peerConns[otherUser].stream = null;
                    if (easyrtc.onStreamClosed) {
                        easyrtc.onStreamClosed(otherUser);
                    }
//                  delete easyrtc.peerConns[otherUser];
                    easyrtc.updateConfigurationInfo();
                }

            };
            easyrtc.peerConns[otherUser] = newPeerConn;
        } catch (e) {
            if (easyrtc.debugPrinter) {
                easyrtc.debugPrinter(JSON.stringify(e));
            }
            failureCB(easyrtc.errCodes.SYSTEM_ERR, e.message);
            return null;
        }

        if (easyrtc.forwardStreamEnabled) {
            if (!easyrtc.localStream) {
                makeLocalStreamFromRemoteStream();
            }
            if (easyrtc.localStream) {
                pc.addStream(easyrtc.localStream);
            }
        }
        else if (easyrtc.videoEnabled || easyrtc.audioEnabled) {
            if (easyrtc.localStream === null) {
                message = "Application program error: attempt to share audio or video before calling easyrtc.initMediaSource.";
                if (easyrtc.debugPrinter) {
                    easyrtc.debugPrinter(message);
                }
                easyrtc.showError(easyrtc.errCodes.DEVELOPER_ERR, message);
                console.error(message);
            }
            else {
                if (easyrtc.debugPrinter) {
                    easyrtc.debugPrinter("adding local media stream to peer connection");
                }
                pc.addStream(easyrtc.localStream);
            }
        }

      
        return pc;
    };
/////
    var doAnswer = function(caller, msgData) {

        if (easyrtc.forwardStreamEnabled) {
            if (!easyrtc.localStream) {
                makeLocalStreamFromRemoteStream();
            }
        }
        else if (!easyrtc.localStream && (easyrtc.videoEnabled || easyrtc.audioEnabled)) {
            easyrtc.initMediaSource(
                    function(s) {
                        doAnswer(caller, msgData);
                    },
                    function(err) {
                        easyrtc.showError(easyrtc.errCodes.MEDIA_ERR, easyrtc.format(easyrtc.constantStrings.localMediaError, err));
                    });
            return;
        }

        var pc = buildPeerConnection(caller, false, function(message) {
            easyrtc.showError(easyrtc.errCodes.SYSTEM_ERR, message);
        });
        var newPeerConn = easyrtc.peerConns[caller];
        if (!pc) {
            if (easyrtc.debugPrinter) {
                easyrtc.debugPrinter("buildPeerConnection failed. Call not answered");
            }
            return;
        }
        var setLocalAndSendMessage1 = function(sessionDescription) {
            if (newPeerConn.cancelled)
                return;
            var sendAnswer = function() {
                if (easyrtc.debugPrinter) {
                    easyrtc.debugPrinter("sending answer");
                }
                sendSignalling(caller, "answer", sessionDescription,
                        null,
                        function(errorCode, errorText) {
                            delete easyrtc.peerConns[caller];
                            easyrtc.showError(errorCode, errorText);
                        });
                easyrtc.peerConns[caller].startedAV = true;
                if (pc.connectDataConnection) {
                    if (easyrtc.debugPrinter) {
                        easyrtc.debugPrinter("calling connectDataConnection(5002,5001)");
                    }
                    pc.connectDataConnection(5002, 5001);
                }
            };
            pc.setLocalDescription(sessionDescription, sendAnswer, function(message) {
                easyrtc.showError(easyrtc.errCodes.INTERNAL_ERR, "setLocalDescription: " + message);
            });
        };
        var sd = null;
        if (window.mozRTCSessionDescription) {
            sd = new mozRTCSessionDescription(msgData);
        }
        else {
            sd = new RTCSessionDescription(msgData);
        }
        if (easyrtc.debugPrinter) {
            easyrtc.debugPrinter("sdp ||  " + JSON.stringify(sd));
        }
        var invokeCreateAnswer = function() {
            if (newPeerConn.cancelled)
                return;
            pc.createAnswer(setLocalAndSendMessage1,
                    function(message) {
                        easyrtc.showError(easyrtc.errCodes.INTERNAL_ERR, "create-answer: " + message);
                    },
                    easyrtc.mediaConstraints);
        };
        if (easyrtc.debugPrinter) {
            easyrtc.debugPrinter("about to call setRemoteDescription in doAnswer");
        }
        try {

            pc.setRemoteDescription(sd, invokeCreateAnswer, function(message) {
                easyrtc.showError(easyrtc.errCodes.INTERNAL_ERR, "set-remote-description: " + message);
            });
        } catch (srdError) {
            console.log("set remote description failed");
            if (easyrtc.debugPrinter) {
                easyrtc.debugPrinter("saw exception in setRemoteDescription");
            }
            easyrtc.showError(easyrtc.errCodes.INTERNAL_ERR, "setRemoteDescription failed: " + srdError.message);
        }
    };

    var queuedMessages = {};
    var clearQueuedMessages = function(caller) {
        queuedMessages[caller] = {
            candidates: []
        };
    };

    function processConnectedList(connectedList) {
        var i;
        for (i in easyrtc.peerConns) {
            if (typeof connectedList[i] === 'undefined') {
                if (easyrtc.peerConns[i].startedAV) {
                    onRemoteHangup(i);
                    clearQueuedMessages(i);
                }
            }
        }
    }

    function processOccupantList(roomName, list) {
        var myInfo = null;
        easyrtc.reducedList = {};
        var id;
        for (id in list) {
            if (id !== easyrtc.myEasyrtcid) {
                easyrtc.reducedList[id] = list[id];
            }
            else {
                myInfo = list[id];
            }
        }
        processConnectedList(easyrtc.reducedList);
        if (easyrtc.roomOccupantListener) {
            easyrtc.roomOccupantListener(roomName, easyrtc.reducedList, myInfo);
        }
    }

    var onChannelMsg = function(msg) {

        var targeting = {};
        if (msg.targetEasyrtcid) {
            targeting.targetEasyrtcid = msg.targetEasyrtcid;
        }
        if (msg.targetRoom) {
            targeting.targetRoom = msg.targetRoom;
        }
        if (msg.targetGroup) {
            targeting.targetGroup = msg.targetGroup;
        }
        if (msg.senderEasyrtcid) {
            easyrtc.receivePeerDistribute(msg.senderEasyrtcid, msg, targeting);
        }
        else {
            if (easyrtc.receiveServerCB) {
                easyrtc.receiveServerCB(msg.msgType, msg.msgData, targeting);
            }
            else {
                console.log("Unhandled server message " + JSON.stringify(msg));
            }
        }
    };

    var onChannelCmd = function(msg, ackAcceptorFn) {

        if (easyrtc.debugPrinter) {
            easyrtc.debugPrinter("received message from socket server=" + JSON.stringify(msg));
        }

        var caller = msg.senderEasyrtcid;
        var msgType = msg.msgType;
        var msgData = msg.msgData;
        var pc;

        if (easyrtc.debugPrinter) {
            easyrtc.debugPrinter('received message of type ' + msgType);
        }

        if (typeof queuedMessages[caller] === "undefined") {
            clearQueuedMessages(caller);
        }

        var processCandidateBody = function(caller, msgData) {
            var candidate = null;
            if (window.mozRTCIceCandidate) {
                candidate = new mozRTCIceCandidate({
                    sdpMLineIndex: msgData.label,
                    candidate: msgData.candidate
                });
            }
            else {
                candidate = new RTCIceCandidate({
                    sdpMLineIndex: msgData.label,
                    candidate: msgData.candidate
                });
            }
            pc = easyrtc.peerConns[caller].pc;
            pc.addIceCandidate(candidate);

            if (msgData.candidate.indexOf("typ relay") > 0) {
                var ipaddress = msgData.candidate.match(/(udp|tcp) \d+ (\d+\.\d+\.\d+\.\d+)/)[1];
                easyrtc._turnServers[ipaddress] = true;
            }
        };

        var flushCachedCandidates = function(caller) {
            var i;
            if (queuedMessages[caller]) {
                for (i = 0; i < queuedMessages[caller].candidates.length; i++) {
                    processCandidateBody(caller, queuedMessages[caller].candidates[i]);
                }
                delete queuedMessages[caller];
            }
        };

        var processOffer = function(caller, msgData) {

            var helper = function(wasAccepted) {
                if (easyrtc.debugPrinter) {
                    easyrtc.debugPrinter("offer accept=" + wasAccepted);
                }
                delete easyrtc.offersPending[caller];
                if (wasAccepted) {
                    doAnswer(caller, msgData);
                    flushCachedCandidates(caller);
                }
                else {
                    sendSignalling(caller, "reject", null, null, null);
                    clearQueuedMessages(caller);
                }
            };
            //
            // There is a very rare case of two callers sending each other offers
            // before receiving the others offer. In such a case, the caller with the
            // greater valued easyrtcid will delete its pending call information and do a
            // simple answer to the other caller's offer.
            //
            if (easyrtc.acceptancePending[caller] && caller < easyrtc.myEasyrtcid) {
                delete easyrtc.acceptancePending[caller];
                if (queuedMessages[caller]) {
                    delete queuedMessages[caller];
                }
                if (easyrtc.peerConns[caller].wasAcceptedCB) {
                    easyrtc.peerConns[caller].wasAcceptedCB(true, caller);
                }
                delete easyrtc.peerConns[caller];
                helper(true);
                return;
            }

            easyrtc.offersPending[caller] = msgData;
            if (!easyrtc.acceptCheck) {
                helper(true);
            }
            else {
                easyrtc.acceptCheck(caller, helper);
            }
        };

        function processReject(caller) {
            delete easyrtc.acceptancePending[caller];
            if (queuedMessages[caller]) {
                delete queuedMessages[caller];
            }
            if (easyrtc.peerConns[caller]) {
                if (easyrtc.peerConns[caller].wasAcceptedCB) {
                    easyrtc.peerConns[caller].wasAcceptedCB(false, caller);
                }
                delete easyrtc.peerConns[caller];
            }
        }

        function processAnswer(caller, msgData) {

            delete easyrtc.acceptancePending[caller];
            if (easyrtc.peerConns[caller].wasAcceptedCB) {
                easyrtc.peerConns[caller].wasAcceptedCB(true, caller);
            }

            var onSignalSuccess = function() {

            };

            var onSignalFailure = function(errorCode, errorText) {
                if (easyrtc.peerConns[caller]) {
                    delete easyrtc.peerConns[caller];
                }
                easyrtc.showError(errorCode, errorText);
            };
            var i;
            easyrtc.peerConns[caller].startedAV = true;
            for (i = 0; i < easyrtc.peerConns[caller].candidatesToSend.length; i++) {
                sendSignalling(
                        caller,
                        "candidate",
                        easyrtc.peerConns[caller].candidatesToSend[i],
                        onSignalSuccess,
                        onSignalFailure
                        );
            }

            pc = easyrtc.peerConns[caller].pc;
            var sd = null;
            if (window.mozRTCSessionDescription) {
                sd = new mozRTCSessionDescription(msgData);
            }
            else {
                sd = new RTCSessionDescription(msgData);
            }
            if (!sd) {
                throw "Could not create the RTCSessionDescription";
            }

            if (easyrtc.debugPrinter) {
                easyrtc.debugPrinter("about to call initiating setRemoteDescription");
            }
            try {
                pc.setRemoteDescription(sd, function() {
                    if (pc.connectDataConnection) {
                        if (easyrtc.debugPrinter) {
                            easyrtc.debugPrinter("calling connectDataConnection(5001,5002)");
                        }
                        pc.connectDataConnection(5001, 5002); // these are like ids for data channels
                    }
                });
            } catch (smdException) {
                console.log("setRemoteDescription failed ", smdException);
            }
            flushCachedCandidates(caller);
        }

        function processCandidateQueue(caller, msgData) {

            if (easyrtc.peerConns[caller] && easyrtc.peerConns[caller].startedAV) {
                processCandidateBody(caller, msgData);
            }
            else {
                if (!easyrtc.peerConns[caller]) {
                    queuedMessages[caller] = {
                        candidates: []
                    };
                }
                queuedMessages[caller].candidates.push(msgData);
            }
        }

        switch (msgType) {
            case "sessionData":
                processSessionData(msgData.sessionData);
                break;
            case "roomData":
                processRoomData(msgData.roomData);
                break;
            case "iceConfig":
                processIceConfig(msgData.iceConfig);
                break;
            case "forwardToUrl":
                if (msgData.newWindow) {
                    window.open(msgData.forwardToUrl.url);
                }
                else {
                    window.location.href = msgData.forwardToUrl.url;
                }
                break;
            case "offer":
                processOffer(caller, msgData);
                break;
            case "reject":
                processReject(caller);
                break;
            case "answer":
                processAnswer(caller, msgData);
                break;
            case "candidate":
                processCandidateQueue(caller, msgData);
                break;
            case "hangup":
                onRemoteHangup(caller);
                clearQueuedMessages(caller);
                break;
            case "error":
                easyrtc.showError(msg.errorCode, msg.errorText);
                break;
            default:
                console.error("received unknown message type from server, msgType is " + msgType);
                return;
        }

        if (ackAcceptorFn) {
            ackAcceptorFn(easyrtc.ackMessage);
        }
    };

    if (!window.io) {
        easyrtc.onError("Your HTML has not included the socket.io.js library");
    }

    function connectToWSServer(successCallback, errorCallback) {
        var i;
        if (!easyrtc.webSocket) {
            easyrtc.webSocket = io.connect(easyrtc.serverPath, {
                'connect timeout': 10000,
                'force new connection': true
            });
            if (!easyrtc.webSocket) {
                throw "io.connect failed";
            }
        }
        else {
            for (i in easyrtc.websocketListeners) {
                easyrtc.webSocket.removeEventListener(easyrtc.websocketListeners[i].event,
                        easyrtc.websocketListeners[i].handler);
            }
        }
        easyrtc.websocketListeners = [];
        function addSocketListener(event, handler) {
            easyrtc.webSocket.on(event, handler);
            easyrtc.websocketListeners.push({event: event, handler: handler});
        }
        addSocketListener("close", function(event) {
            console.log("the web socket closed");
        });
        addSocketListener('error', function(event) {
            function handleErrorEvent() {
                if (easyrtc.myEasyrtcid) {
                    if (easyrtc.webSocket.socket.connected) {
                        easyrtc.showError(easyrtc.errCodes.SIGNAL_ERROR, easyrtc.constantStrings.miscSignalError);
                    }
                    else {
                        /* socket server went down. this will generate a 'disconnect' event as well, so skip this event */
                        console.warn("The connection to the EasyRTC socket server went down. It may come back by itself.");
                    }
                }
                else {
                    errorCallback(easyrtc.errCodes.CONNECT_ERR, easyrtc.constantStrings.noServer);
                }
            }

            setTimeout(handleErrorEvent, 1);
        });
        addSocketListener("connect", function(event) {

            easyrtc.webSocketConnected = true;
            if (!easyrtc.webSocket || !easyrtc.webSocket.socket || !easyrtc.webSocket.socket.sessionid) {
                easyrtc.showError(easyrtc.errCodes.CONNECT_ERR, easyrtc.constantStrings.badsocket);
            }

            if (easyrtc.debugPrinter) {
                easyrtc.debugPrinter("saw socketserver onconnect event");
            }
            if (easyrtc.webSocketConnected) {
                sendAuthenticate(successCallback, errorCallback);
            }
            else {
                errorCallback(easyrtc.errCodes.SIGNAL_ERROR, easyrtc.constantStrings.icf);
            }
        }
        );
        addSocketListener("easyrtcMsg", onChannelMsg);
        addSocketListener("easyrtcCmd", onChannelCmd);
        addSocketListener("disconnect", function(code, reason, wasClean) {
            easyrtc.webSocketConnected = false;
            easyrtc.updateConfigurationInfo = function() {
            }; // dummy update function
            easyrtc.oldConfig = {};
            easyrtc.disconnectBody();
            if (easyrtc.disconnectListener) {
                easyrtc.disconnectListener();
            }
        });
    }
    connectToWSServer(successCallback, errorCallback);


  //  easyrtc.oldConfig = {}; // used internally by updateConfiguration

//
// this function collects configuration info that will be sent to the server.
// It returns that information, leaving it the responsibility of the caller to
// do the actual sending.
//
    easyrtc.collectConfigurationInfo = function(forAuthentication) {
        var p2pList = {};
        var i;
        for (i in easyrtc.peerConns) {
            p2pList[i] = {
                connectTime: easyrtc.peerConns[i].connectTime,
                isInitiator: easyrtc.peerConns[i].isInitiator ? true : false
            };
        }

        var newConfig = {
            userSettings: {
                sharingAudio: easyrtc.haveAudioVideo.audio ? true : false,
                sharingVideo: easyrtc.haveAudioVideo.video ? true : false,
                sharingData: easyrtc.dataEnabled ? true : false,
                nativeVideoWidth: easyrtc.nativeVideoWidth,
                nativeVideoHeight: easyrtc.nativeVideoHeight,
                windowWidth: window.innerWidth,
                windowHeight: window.innerHeight,
                screenWidth: window.screen.width,
                screenHeight: window.screen.height,
                cookieEnabled: navigator.cookieEnabled,
                os: navigator.oscpu,
                language: navigator.language
            }
        };
        if (!isEmptyObj(p2pList)) {
            newConfig.p2pList = p2pList;
        }
        return newConfig;
    };
	
    function updateConfiguration() {

        var newConfig = easyrtc.collectConfigurationInfo(false);
        //
        // we need to give the getStats calls a chance to fish out the data.
        // The longest I've seen it take is 5 milliseconds so 100 should be overkill.
        //
        var sendDeltas = function() {
            var alteredData = findDeltas(easyrtc.oldConfig, newConfig);
            //
            // send all the configuration information that changes during the session
            //
            if (easyrtc.debugPrinter) {
                easyrtc.debugPrinter("cfg=" + JSON.stringify(alteredData.added));
            }
            if (easyrtc.webSocket) {
                sendSignalling(null, "setUserCfg", {setUserCfg: alteredData.added}, null, null);
            }
            easyrtc.oldConfig = newConfig;
        };
        if (easyrtc.oldConfig === {}) {
            sendDeltas();
        }
        else {
            setTimeout(sendDeltas, 100);
        }
    }
    easyrtc.updateConfigurationInfo = function() {
        updateConfiguration();
    };
  
    
    /**
     * Fetch the value of a session field by name.
     * @param {String} name - name of the session field to be fetched.
     * @returns the field value (which can be anything). Returns undefined if the field does not exist.
     */
   
    function processRoomData(roomData) {
        easyrtc.roomData = roomData;
        var roomname;
        var stuffToRemove;
        var stuffToAdd;
        var id, removeId;
        for (roomname in easyrtc.roomData) {
            if (roomData[roomname].roomStatus === "join") {
                if (easyrtc.roomEntryListener) {
                    easyrtc.roomEntryListener(true, roomname);
                }
                if (!(easyrtc.roomJoin[roomname])) {
                    easyrtc.roomJoin[roomname] = roomData[roomname];
                }
            }
            else if (roomData[roomname].roomStatus === "leave") {
                if (easyrtc.roomEntryListener) {
                    easyrtc.roomEntryListener(false, roomname);
                }
                delete easyrtc.roomJoin[roomname];
                continue;
            }

            if (roomData[roomname].clientList) {
                easyrtc.lastLoggedInList[roomname] = roomData[roomname].clientList;
            }
            else if (roomData[roomname].clientListDelta) {
                stuffToAdd = roomData[roomname].clientListDelta.updateClient;
                if (stuffToAdd) {
                    for (id in stuffToAdd) {
                        if (!easyrtc.lastLoggedInList[roomname]) {
                            easyrtc.lastLoggedInList[roomname] = [];
                        }
                        easyrtc.lastLoggedInList[roomname][id] = stuffToAdd[id];
                    }
                }
                stuffToRemove = roomData[roomname].clientListDelta.removeClient;
                if (stuffToRemove) {
                    for (removeId in stuffToRemove) {
                        delete easyrtc.lastLoggedInList[roomname][removeId];
                    }
                }
            }
            if (easyrtc.roomJoin[roomname] && roomData[roomname].field) {
                easyrtc.fields.rooms[roomname] = roomData[roomname].field;
            }
            processOccupantList(roomname, easyrtc.lastLoggedInList[roomname]);
        }
        easyrtc.emitEvent("roomOccupant", easyrtc.lastLoggedInList);
    }

    easyrtc._processRoomData = processRoomData;

    easyrtc.isTurnServer = function(ipaddress) {
        return !!easyrtc._turnServers[ipaddress];
    };

    function processIceConfig(iceConfig) {
        easyrtc.pc_config = {iceServers: []};
        easyrtc._turnServers = {};
        var i;
        var item, fixedItem, parts, username, url, ipaddress;

        for (i = 0; i < iceConfig.iceServers.length; i++) {
            item = iceConfig.iceServers[i];
            if (item.url.indexOf('turn:') === 0) {
                if (item.username) {
                    fixedItem = createIceServer(item.url, item.username, item.credential);
                }
                else {
                    easyrtc.showError("badparam", "Iceserver entry doesn't have a username: " + JSON.stringify(item));
                }
                ipaddress = item.url.split(/[@:&]/g)[1];
                easyrtc._turnServers[ipaddress] = true;
            }
            else { // is stun server entry
                fixedItem = item;
            }
            if (fixedItem) {
                easyrtc.pc_config.iceServers.push(fixedItem);
            }
        }
    }

    /**
     * Request fresh ice config information from the server.
     * This should be done periodically by long running applications.
     * There are no parameters or return values.
     */
   
    function processToken(msg) {
        if (easyrtc.debugPrinter) {
            easyrtc.debugPrinter("entered process token");
        }
        var msgData = msg.msgData;
        if (msgData.easyrtcid) {
            easyrtc.myEasyrtcid = msgData.easyrtcid;
        }
        if (msgData.field) {
            easyrtc.fields.connection = msgData.field;
        }
        if (msgData.iceConfig) {
            processIceConfig(msgData.iceConfig);
        }

        if (msgData.sessionData) {
            processSessionData(msgData.sessionData);
        }

        if (msgData.roomData) {
            processRoomData(msgData.roomData);
        }

        if (msgData.application.field) {
            easyrtc.fields.application = msgData.application.field;
        }

    }

    function sendAuthenticate(successCallback, errorCallback) {
        //
        // find our easyrtsid
        //  
        var cookies, target, i;
        var easyrtcsid = null;
        if (easyrtc.cookieId && document.cookie) {
            cookies = document.cookie.split(/[; ]/g);
            target = easyrtc.cookieId + "=";
            for (i in cookies) {
                if (cookies[i].indexOf(target) === 0) {
                    var cookie = cookies[i].substring(target.length);
                    easyrtcsid = cookie;
                }
            }
        }

        if (!easyrtc.roomJoin) {
            easyrtc.roomJoin = {};
        }

        var msgData = {
            apiVersion: easyrtc.apiVersion,
            applicationName: applicationName,
            setUserCfg: easyrtc.collectConfigurationInfo(true)
        };
        if (easyrtc.presenceShow) {
            msgData.setPresence = {show: easyrtc.presenceShow, status: easyrtc.presenceStatus};
        }
        if (easyrtc.username) {
            msgData.username = easyrtc.username;
        }
        if (easyrtc.roomJoin && !isEmptyObj(easyrtc.roomJoin)) {
            msgData.roomJoin = easyrtc.roomJoin;
        }
        if (easyrtcsid) {
            msgData.easyrtcsid = easyrtcsid;
        }
        if (easyrtc.credential) {
            msgData.credential = easyrtc.credential;
        }

        easyrtc.webSocket.json.emit("easyrtcAuth",
                {msgType: "authenticate",
                    msgData: msgData
                },
        function(msg) {
            var room;
            if (msg.msgType === "error") {
                errorCallback(msg.msgData.errorCode, msg.msgData.errorText);
                easyrtc.roomJoin = {};
            }
            else {
                processToken(msg);
                if (easyrtc._roomApiFields) {
                    for (room in easyrtc._roomApiFields) {
                        easyrtc._enqueueSendRoomApi(room, easyrtc._roomApiFields[room]);
                    }
                }

                if (successCallback) {
                    successCallback(easyrtc.myEasyrtcid);
                }
            }
        }
        );
    }
};


/** Get server defined fields associated with the connection. Only valid
 * after a connection has been made.
 * @returns {Dictionary} A dictionary containing entries of the form {key:{'fieldname':key, 'fieldvalue':value1}}
 */

// this flag controls whether the easyApp routine adds close buttons to the caller
// video objects

/** @private */
easyrtc.autoAddCloseButtons = true;

/**
 * Validates that the video ids correspond to dom objects.
 * @param {type} monitorVideoId
 * @param {type} videoIds
 * @returns {undefined}
 * @private
 */
easyrtc._validateVideoIds = function(monitorVideoId, videoIds) {
    var i;
    // verify that video ids were not typos.
    if (monitorVideoId && !document.getElementById(monitorVideoId)) {
        easyrtc.showError(easyrtc.errCodes.DEVELOPER_ERR, "The monitor video id passed to easyApp was bad, saw " + monitorVideoId);
        return false;
    }

    for (i in videoIds) {
        var name = videoIds[i];
        if (!document.getElementById(name)) {
            easyrtc.showError(easyrtc.errCodes.DEVELOPER_ERR, "The caller video id '" + name + "' passed to easyApp was bad.");
            return false;
        }
    }
    return true;
};

/**
 * This is a helper function for the easyApp method. It manages the assignment of video streams
 * to video objects. It assumes
 * @param {type} monitorVideoId
 * @param {type} videoIds
 * @returns {void}
 */
easyrtc.easyAppBody = function(monitorVideoId, videoIds) {
    var numPEOPLE = videoIds.length;
    var refreshPane = 0;
    var onCall = null, onHangup = null, gotMediaCallback = null, gotConnectionCallback = null;
    if (videoIds === null) {
        videoIds = [];
    }

    function videoIsFree(obj) {
        return (obj.caller === "" || obj.caller === null || obj.caller === undefined);
    }

    if (!easyrtc._validateVideoIds(monitorVideoId, videoIds)) {
        throw "bad video element id";
    }

    if (monitorVideoId) {
        document.getElementById(monitorVideoId).muted = "muted";
    }

    /** Sets an event handler that gets called when a call is established.
     * It's only purpose (so far) is to support transitions on video elements.
     * This function is only defined after easyrtc.easyApp is called.
     * The slot argument is the index into the array of video ids.
     * @param {Function} cb has the signature function(easyrtcid, slot){}
     * @example
     *   easyrtc.setOnCall( function(easyrtcid, slot){
     *      console.log("call with " + easyrtcid + "established");
     *   });
     */
  /*  easyrtc.setOnCall = function(cb) {
        onCall = cb;
    };*/
    /** Sets an event handler that gets called when a call is ended.
     * it's only purpose (so far) is to support transitions on video elements.
     x     * this function is only defined after easyrtc.easyApp is called.
     * The slot is parameter is the index into the array of video ids.
     * Note: if you call easyrtc.getConnectionCount() from inside your callback
     * it's count will reflect the number of connections before the hangup started.
     * @param {Function} cb has the signature function(easyrtcid, slot){}
     * @example
     *   easyrtc.setOnHangup( function(easyrtcid, slot){
     *      console.log("call with " + easyrtcid + "ended");
     *   });
     */
  
    function getIthVideo(i) {
        if (videoIds[i]) {
            return document.getElementById(videoIds[i]);
        }
        else {
            return null;
        }
    }



   function hideVideo(video) {
        easyrtc.setVideoObjectSrc(video, "");
        video.style.visibility = "hidden";
    }

 
    easyrtc.setStreamAcceptor(function(caller, stream) {
        if (easyrtc.debugPrinter) {
            easyrtc.debugPrinter("stream acceptor called");
        }
        function showVideo(video, stream) {
            easyrtc.setVideoObjectSrc(video, stream);
            if (video.style.visibility) {
                video.style.visibility = 'visible';
            }
        }

        var i, video;
        if (refreshPane && videoIsFree(refreshPane)) {
            showVideo(video, stream);
            if (onCall) {
                onCall(caller, refreshPane);
            }
            refreshPane = null;
            return;
        }
        for (i = 0; i < numPEOPLE; i++) {
            video = getIthVideo(i);
            if (video.caller === caller) {
                showVideo(video, stream);
                if (onCall) {
                    onCall(caller, i);
                }
                return;
            }
        }

        for (i = 0; i < numPEOPLE; i++) {
            video = getIthVideo(i);
            if (!video.caller || videoIsFree(video)) {
                video.caller = caller;
                if (onCall) {
                    onCall(caller, i);
                }
                showVideo(video, stream);
                return;
            }
        }
//
// no empty slots, so drop whatever caller we have in the first slot and use that one.
//
        video = getIthVideo(0);
        if (video) {
            easyrtc.hangup(video.caller);
            showVideo(video, stream);
            if (onCall) {
                onCall(caller, 0);
            }
        }
        video.caller = caller;
    });
    
	var addControls, parentDiv, closeButton;
    if (easyrtc.autoAddCloseButtons) {

        addControls = function(video) {
            parentDiv = video.parentNode;
            video.caller = "";
            closeButton = document.createElement("div");
            closeButton.className = "easyrtc_closeButton";
            closeButton.onclick = function() {
                if (video.caller) {
                    easyrtc.hangup(video.caller);
                    hideVideo(video);
                    video.caller = "";
                }
            };
            parentDiv.appendChild(closeButton);
        };

        for (i = 0; i < numPEOPLE; i++) {
            addControls(getIthVideo(i));
        }
    }

    var monitorVideo = null;
    if (easyrtc.videoEnabled && monitorVideoId !== null) {
        monitorVideo = document.getElementById(monitorVideoId);
        if (!monitorVideo) {
            console.error("Programmer error: no object called " + monitorVideoId);
            return;
        }
        monitorVideo.muted = "muted";
        monitorVideo.defaultMuted = true;
    }


};

/**
 * Provides a layer on top of the easyrtc.initMediaSource and easyrtc.connect, assign the local media stream to
 * the video object identified by monitorVideoId, assign remote video streams to
 * the video objects identified by videoIds, and then call onReady. One of it's
 * side effects is to add hangup buttons to the remote video objects, buttons
 * that only appear when you hover over them with the mouse cursor. This method will also add the
 * easyrtcMirror class to the monitor video object so that it behaves like a mirror.
 *  @param {String} applicationName - name of the application.
 *  @param {String} monitorVideoId - the id of the video object used for monitoring the local stream.
 *  @param {Array} videoIds - an array of video object ids (strings)
 *  @param {Function} onReady - a callback function used on success. It is called with the easyrtcId this peer is knopwn to the server as.
 *  @param {Function} onFailure - a callbackfunction used on failure (failed to get local media or a connection of the signaling server).
 *  @example
 *     easyrtc.easyApp('multiChat', 'selfVideo', ['remote1', 'remote2', 'remote3'],
 *              function(easyrtcId){
 *                  console.log("successfully connected, I am " + easyrtcId);
 *              },
 *              function(errorCode, errorText){
 *                  console.log(errorText);
 *              );
 */
easyrtc.easyApp = function(applicationName, monitorVideoId, videoIds, onReady, onFailure) {
    gotMediaCallback = null, gotConnectionCallback = null;

    if (!easyrtc._validateVideoIds(monitorVideoId, videoIds)) {
        throw "bad video id";
    }

    easyrtc.easyAppBody(monitorVideoId, videoIds);

    easyrtc.setGotMedia = function(gotMediaCB) {
        gotMediaCallback = gotMediaCB;
    };
    /** Sets an event handler that gets called when a connection to the signaling
     * server has or has not been made. Can only be called after calling easyrtc.easyApp.
     * @param {Function} gotConnectionCB has the signature (gotConnection, errorText)
     * @example
     *    easyrtc.setGotConnection( function(gotConnection, errorText){
     *        if( gotConnection ){
     *            console.log("Successfully connected to signaling server");
     *        }
     *        else{
     *            console.log("Failed to connect to signaling server because: " + errorText);
     *        }
     *    });
     */
    easyrtc.setGotConnection = function(gotConnectionCB) {
        gotConnectionCallback = gotConnectionCB;
    };




    var nextInitializationStep;
    nextInitializationStep = function(token) {
        if (gotConnectionCallback) {
            gotConnectionCallback(true, "");
        }
        onReady(easyrtc.myEasyrtcid);
    };
    easyrtc.initMediaSource(
            function() {
                if (gotMediaCallback) {
                    gotMediaCallback(true, null);
                }
                if (monitorVideoId !== null) {
                    easyrtc.setVideoObjectSrc(document.getElementById(monitorVideoId), easyrtc.getLocalStream());
                }
                function connectError(errorCode, errorText) {
                    if (gotConnectionCallback) {
                        gotConnectionCallback(false, errorText);
                    }
                    else {
                        easyrtc.showError(easyrtc.errCodes.CONNECT_ERR, errorText);
                    }
                    if (onFailure) {
                        onFailure(easyrtc.errCodes.CONNECT_ERR, errorText);
                    }
                }
                easyrtc.connect(applicationName, nextInitializationStep, connectError);
            },
            function(errorcode, errorText) {
                if (gotMediaCallback) {
                    gotMediaCallback(false, errorText);
                }
                else {
                    easyrtc.showError(easyrtc.errCodes.MEDIA_ERR, errorText);
                }
                if (onFailure) {
                    onFailure(easyrtc.errCodes.MEDIA_ERR, errorText);
                }
            }
    );
};
/**
 *
 * @deprecated now called easyrtc.easyApp.
 */
easyrtc.initManaged = easyrtc.easyApp;
//
// the below code is a copy of the standard polyfill adapter.js
//
var getUserMedia = null;
var attachMediaStream = null;
var reattachMediaStream = null;
var webrtcDetectedBrowser = null;
var webrtcDetectedVersion = null;
if (navigator.mozGetUserMedia) {
// console.log("This appears to be Firefox");

    webrtcDetectedBrowser = "firefox";
    webrtcDetectedVersion =
            parseInt(navigator.userAgent.match(/Firefox\/([0-9]+)\./)[1]);
    // The RTCPeerConnection object.
    window.RTCPeerConnection = mozRTCPeerConnection;
    // The RTCSessionDescription object.
    window.RTCSessionDescription = mozRTCSessionDescription;
    // The RTCIceCandidate object.
    window.RTCIceCandidate = mozRTCIceCandidate;
    // Get UserMedia (only difference is the prefix).
    // Code from Adam Barth.
    window.getUserMedia = navigator.mozGetUserMedia.bind(navigator);
    // Creates iceServer from the url for FF.
    window.createIceServer = function(url, username, password) {
        var iceServer = null;
        var url_parts = url.split(':');
        var turn_url_parts;
        if (url_parts[0].indexOf('stun') === 0) {
// Create iceServer with stun url.
            iceServer = {'url': url};
        } else if (url_parts[0].indexOf('turn') === 0 &&
                (url.indexOf('transport=udp') !== -1 ||
                        url.indexOf('?transport') === -1)) {
// Create iceServer with turn url.
// Ignore the transport parameter from TURN url.
            turn_url_parts = url.split("?");
            iceServer = {'url': turn_url_parts[0],
                'credential': password,
                'username': username};
        }
        return iceServer;
    };
    // Attach a media stream to an element.
    attachMediaStream = function(element, stream) {
//        console.log("Attaching media stream");
        element.mozSrcObject = stream;
        element.play();
    };
    reattachMediaStream = function(to, from) {
//        console.log("Reattaching media stream");
        to.mozSrcObject = from.mozSrcObject;
        to.play();
    };
    if (webrtcDetectedVersion < 23) {
// Fake get{Video,Audio}Tracks
        MediaStream.prototype.getVideoTracks = function() {
            return [];
        };
        MediaStream.prototype.getAudioTracks = function() {
            return [];
        };
    }
} else if (navigator.webkitGetUserMedia) {
//    console.log("This appears to be Chrome");

    webrtcDetectedBrowser = "chrome";
    webrtcDetectedVersion =
            parseInt(navigator.userAgent.match(/Chrom(e|ium)\/([0-9]+)\./)[2]);
    // Creates iceServer from the url for Chrome.
    window.createIceServer = function(url, username, password) {
        var iceServer = null;
        var url_turn_parts;
        var url_parts = url.split(':');
        if (url_parts[0].indexOf('stun') === 0) {
// Create iceServer with stun url.
            iceServer = {'url': url};
        } else if (url_parts[0].indexOf('turn') === 0) {
            if (webrtcDetectedVersion < 28) {
// For pre-M28 chrome versions use old TURN format.
                url_turn_parts = url.split("turn:");
                iceServer = {'url': 'turn:' + username + '@' + url_turn_parts[1],
                    'credential': password};
            } else {
// For Chrome M28 & above use new TURN format.
                iceServer = {'url': url,
                    'credential': password,
                    'username': username};
            }
        }
        return iceServer;
    };
    // The RTCPeerConnection object.
    window.RTCPeerConnection = webkitRTCPeerConnection;
    // Get UserMedia (only difference is the prefix).
    // Code from Adam Barth.
    window.getUserMedia = navigator.webkitGetUserMedia.bind(navigator);
    // Attach a media stream to an element.
    attachMediaStream = function(element, stream) {
        if (typeof element.srcObject !== 'undefined') {
            element.srcObject = stream;
        } else if (typeof element.mozSrcObject !== 'undefined') {
            element.mozSrcObject = stream;
        } else if (typeof element.src !== 'undefined') {
            element.src = URL.createObjectURL(stream);
        } else {
            console.log('Error attaching stream to element.');
        }
    };
    reattachMediaStream = function(to, from) {
        to.src = from.src;
    };
    // The representation of tracks in a stream is changed in M26.
    // Unify them for earlier Chrome versions in the coexisting period.
    if (!webkitMediaStream.prototype.getVideoTracks) {
        webkitMediaStream.prototype.getVideoTracks = function() {
            return this.videoTracks;
        };
        webkitMediaStream.prototype.getAudioTracks = function() {
            return this.audioTracks;
        };
    }

// New syntax of getXXXStreams method in M26.
    if (!webkitRTCPeerConnection.prototype.getLocalStreams) {
        webkitRTCPeerConnection.prototype.getLocalStreams = function() {
            return this.localStreams;
        };
        webkitRTCPeerConnection.prototype.getRemoteStreams = function() {
            return this.remoteStreams;
        };
    }
} else {
    console.log("Browser does not appear to be WebRTC-capable");
}


/** @private */
easyrtc.isMozilla = (webrtcDetectedBrowser === "firefox");

easyrtc.constantStrings = {
  "unableToEnterRoom":"Unable to enter room {0} because {1}" ,
  "resolutionWarning": "Requested video size of {0}x{1} but got size of {2}x{3}",
  "badUserName": "Illegal username {0}",
  "localMediaError": "Error getting local media stream: {0}",
  "miscSignalError": "Miscellaneous error from signalling server. It may be ignorable.",
  "noServer": "Unable to reach the EasyRTC signalling server.",
  "badsocket": "Socket.io connect event fired with bad websocket.",
  "icf": "Internal communications failure"
};

easyrtc.supportsDataChannels = function() {
    if (navigator.userAgent.match(/android/i)) {
        return webrtcDetectedVersion >= 34;
    }
    else {
        return (webrtcDetectedBrowser === "firefox" || webrtcDetectedVersion >= 32);
    }
};















































///
var easyrtc = {};

//
// for supporting internationalization
//
easyrtc.format = function() {
    var formatted = arguments[0];
    for (var i = 1; i < arguments.length; i++) {
        var regexp = new RegExp('\\{' + (i - 1) + '\\}', 'gi');
        formatted = formatted.replace(regexp, arguments[i]);
    }
    return formatted;
};

/** @private
 * @param {Object} destObject
 * @param {Object} allowedEventsArray
 */
var easyrtcAddEventHandling = function(destObject, allowedEventsArray) {
    var i;
    //
    // build a dictionary of allowed events for this object.
    //
    var allowedEvents = {};
    for (i = 0; i < allowedEventsArray.length; i++) {
        allowedEvents[allowedEventsArray[i]] = true;
    }
    //
    // verify that the eventName argument is a valid event type for the object.
    //
    function eventChecker(eventName, src) {
        if (typeof eventName !== 'string') {
            easyrtc.showError(easyrtc.errCodes.DEVELOPER_ERR, src + " called without a string as the first argument");
            throw "developer error";
        }
        if (!allowedEvents[eventName]) {
            easyrtc.showError(easyrtc.errCodes.DEVELOPER_ERR, src + " called with a bad event name = " + eventName);
            throw "developer error";
        }
    }
    var eventListeners = {};
    destObject.addEventListener = function(eventName, eventListener) {
        eventChecker(eventName, "addEventListener");
        if (typeof eventListener !== 'function') {
            easyrtc.showError(easyrtc.errCodes.DEVELOPER_ERR, "addEventListener called with a nonfunction for second argument");
            throw "developer error";
        }
        //
        // remove the event listener if it's already present so we don't end up with two copies
        //
        destObject.removeEventListener(eventName, eventListener);
        if (!eventListeners[eventName]) {
            eventListeners[eventName] = [];
        }
        eventListeners[eventName][eventListeners[eventName].length] = eventListener;
    };
    destObject.removeEventListener = function(eventName, eventListener) {
        eventChecker(eventName, "removeEventListener");
        var listeners = eventListeners[eventName];
        var i = 0;
        if (listeners) {
            for (i = 0; i < listeners.length; i++) {
                if (listeners[i] === eventListener) {
                    if (i < listeners.length - 1) {
                        listeners[i] = listeners[listeners.length - 1];
                    }
                    listeners.length = listeners.length - 1;
                }
            }
        }
    };
    destObject.emitEvent = function(eventName, eventData) {
        eventChecker(eventName, "emitEvent");
        var listeners = eventListeners[eventName];
        var i = 0;
        if (listeners) {
            for (i = 0; i < listeners.length; i++) {
                listeners[i](eventName, eventData);
            }
        }
    };
};

//easyrtcAddEventHandling(easyrtc, ["roomOccupant"]);

/** Error codes that the EasyRTC will use in the errorCode field of error object passed
 *  to error handler set by easyrtc.setOnError. The error codes are short printable strings.
 * @type Dictionary
 */
easyrtc.errCodes = {
    BAD_NAME: "BAD_NAME", // a user name wasn't of the desired form
    CALL_ERR: "CALL_ERR", // something went wrong creating the peer connection
    DEVELOPER_ERR: "DEVELOPER_ERR", // the developer using the EasyRTC library made a mistake
    SYSTEM_ERR: "SYSTEM_ERR", // probably an error related to the network
    CONNECT_ERR: "CONNECT_ERR", // error occurred when trying to create a connection
    MEDIA_ERR: "MEDIA_ERR", // unable to get the local media
    MEDIA_WARNING: "MEDIA_WARNING", // didn't get the desired resolution
    INTERNAL_ERR: "INTERNAL_ERR",
    PEER_GONE: "PEER_GONE", // peer doesn't exist
    ALREADY_CONNECTED: "ALREADY_CONNECTED"
};
easyrtc.apiVersion = "1.0.10";
/** Most basic message acknowledgment object */
easyrtc.ackMessage = {msgType: "ack", msgData: {}};
/** Regular expression pattern for user ids. This will need modification to support non US character sets */
easyrtc.usernameRegExp = /^(.){1,64}$/;
/** @private */
easyrtc.cookieId = "easyrtcsid";
/** @private */
easyrtc.username = null;
/** @private */
easyrtc.loggingOut = false;
/** @private */
easyrtc.disconnecting = false;
/** @private */
easyrtc.localStream = null;
/** @private */
easyrtc.videoFeatures = true; // default video
easyrtc.audioFeatures = true; // default audio
158


easyrtc.audioEnabled = true;

/** @private */
easyrtc.videoEnabled = true;
/** @private */
easyrtc.forwardStreamEnabled = false;
/** @private */
easyrtc.datachannelName = "dc";
/** @private */
easyrtc.debugPrinter = null;
/** Your easyrtcid */
easyrtc.myEasyrtcid = "";
/** @private */
easyrtc.oldConfig = {};
/** @private */
easyrtc.offersPending = {};
200

/** Checks if the supplied string is a valid user name (standard identifier rules)
 * @param {String} name
 * @return {Boolean} true for a valid user name
 * @example
 *    var name = document.getElementById('nameField').value;
 *    if( !easyrtc.isNameValid(name)){
 *        console.error("Bad user name");
 *    }
 */
easyrtc.isNameValid = function(name) {
    return easyrtc.usernameRegExp.test(name);
};
331
/**
 * Determines if the local browser supports WebRTC GetUserMedia (access to camera and microphone).
 * @returns {Boolean} True getUserMedia is supported.
 */
easyrtc.supportsGetUserMedia = function() {
    return !!getUserMedia;
};
/**
 * Determines if the local browser supports WebRTC Peer connections to the extent of being able to do video chats.
 * @returns {Boolean} True if Peer connections are supported.
 */
easyrtc.supportsPeerConnections = function() {
    if (!easyrtc.supportsGetUserMedia()) {
        return false;
    }
    if (!window.RTCPeerConnection) {
        return false;
    }
    try {
        easyrtc.createRTCPeerConnection({"iceServers": []}, null);
    } catch (oops) {
        return false;
    }
    return true;
};
467



/** @private */
easyrtc.haveAudioVideo = {
    audio: false,
    video: false
};
/** @private */
easyrtc.dataEnabled = false;
/** @private */
easyrtc.serverPath = null;
/** @private */
easyrtc.roomOccupantListener = null;
/** @private */
easyrtc.onDataChannelOpen = null;
/** @private */
easyrtc.onDataChannelClose = null;
/** @private */
easyrtc.lastLoggedInList = {};
/** @private */
easyrtc.receivePeer = {msgTypes: {}};
/** @private */
easyrtc.receiveServerCB = null;
/** @private */
easyrtc.updateConfigurationInfo = function() {

};

520

/** Set the callback that will be invoked when the list of people logged in changes.
 * The callback expects to receive a room name argument, and
 *  a map whose ideas are easyrtcids and whose values are in turn maps
 * supplying user specific information. The inner maps have the following keys:
 *  username, applicationName, browserFamily, browserMajor, osFamily, osMajor, deviceFamily.
 *  The third argument is the listener is the innerMap for the connections own data (not needed by most applications).
 * @param {Function} listener
 * @example
 *   easyrtc.setRoomOccupantListener( function(roomName, list, selfInfo){
 *      for( var i in list ){
 *         ("easyrtcid=" + i + " belongs to user " + list[i].username);
 *      }
 *   });
 */
easyrtc.setRoomOccupantListener = function(listener) {
    easyrtc.roomOccupantListener = listener;
};

990



**
 * Returns a media stream for your local camera and microphone.
 *  It can be called only after easyrtc.initMediaSource has succeeded.
 *  It returns a stream that can be used as an argument to easyrtc.setVideoObjectSrc.
 * @return {MediaStream}
 * @example
 *    easyrtc.setVideoObjectSrc( document.getElementById("myVideo"), easyrtc.getLocalStream());
 */
easyrtc.getLocalStream = function() {
    return easyrtc.localStream;
};
/** Clears the media stream on a video object.
 *
 * @param {DomElement} element the video object.
 * @example
 *    easyrtc.clearMediaStream( document.getElementById('selfVideo'));
 *
 */
easyrtc.clearMediaStream = function(element) {
    if (typeof element.srcObject !== 'undefined') {
        element.srcObject = null;
    } else if (typeof element.mozSrcObject !== 'undefined') {
        element.mozSrcObject = null;
    } else if (typeof element.src !== 'undefined') {
        element.src = null;
    } else {
    }
};
/**
 *  Sets a video or audio object from a media stream.
 *  Chrome uses the src attribute and expects a URL, while firefox
 *  uses the mozSrcObject and expects a stream. This procedure hides
 *  that from you.
 *  If the media stream is from a local webcam, you may want to add the
 *  easyrtcMirror class to the video object so it looks like a proper mirror.
 *  The easyrtcMirror class is defined in easyrtc.css.
 *  Which is could be added using the same path of easyrtc.js file to an HTML file
 *  @param {DOMObject} videoObject an HTML5 video object
 *  @param {MediaStream} stream a media stream as returned by easyrtc.getLocalStream or your stream acceptor.
 * @example
 *    easyrtc.setVideoObjectSrc( document.getElementById("myVideo"), easyrtc.getLocalStream());
 *
 */
easyrtc.setVideoObjectSrc = function(videoObject, stream) {
    if (stream && stream !== "") {
        videoObject.autoplay = true;
        attachMediaStream(videoObject, stream);
        videoObject.play();
    }
    else {
        easyrtc.clearMediaStream(videoObject);
    }
};

1180


/** Initializes your access to a local camera and microphone.
 *  Failure could be caused a browser that didn't support WebRTC, or by the user
 * not granting permission.
 * If you are going to call easyrtc.enableAudio or easyrtc.enableVideo, you need to do it before
 * calling easyrtc.initMediaSource.
 * @param {Function} successCallback - will be called when the media source is ready.
 * @param {Function} errorCallback - is called with a message string if the attempt to get media failed.
 * @example
 *       easyrtc.initMediaSource(
 *          function(){
 *              easyrtc.setVideoObjectSrc( document.getElementById("mirrorVideo"), easyrtc.getLocalStream());
 *          },
 *          function(){
 *               easyrtc.showError("no-media", "Unable to get local media");
 *          });
 *
 */
easyrtc.initMediaSource = function(successCallback, errorCallback) {

    if (easyrtc.debugPrinter) {
        easyrtc.debugPrinter("about to request local media");
    }

    if (!window.getUserMedia) {
        errorCallback("Your browser doesn't appear to support WebRTC.");
    }

    if (errorCallback === null) {
        errorCallback = function(errorCode, errorText) {
            var message = "easyrtc.initMediaSource: " + easyrtc.formatError(errorText);
            if (easyrtc.debugPrinter) {
                easyrtc.debugPrinter(message);
            }
            easyrtc.showError(easyrtc.errCodes.MEDIA_ERR, message);
        };
    }

    if (!successCallback) {
        console.error("easyrtc.initMediaSource not supplied a successCallback");
        return;
    }


    var mode = {'audio': (easyrtc.audioEnabled ? easyrtc.audioFeatures : false),
        'video': ((easyrtc.videoEnabled) ? (easyrtc.videoFeatures) : false)};

    if (easyrtc.videoEnabled && easyrtc.videoFeatures && easyrtc.videoFeatures.mandatory &&
            easyrtc.videoFeatures.mandatory.chromeMediaSource === "screen") {
        if (mode.audio) {
            mode.audio = false;
            easyrtc.showError(easyrtc.errCodes.DEVELOPER_ERR,
                    "You can't have audio with a screen share. Masking your audio.");
        }
    }
	/** @private
     * @param {Stream} stream
     *  */
    var onUserMediaSuccess = function(stream) {
        if (easyrtc.debugPrinter) {
            easyrtc.debugPrinter("getUserMedia success callback entered");
        }


        if (easyrtc.debugPrinter) {
            easyrtc.debugPrinter("successfully got local media");
        }
        easyrtc.localStream = stream;
        var videoObj, triesLeft, tryToGetSize, ele;
        if (easyrtc.haveAudioVideo.video) {
            videoObj = document.createElement('video');
            videoObj.muted = true;
            triesLeft = 30;
            tryToGetSize = function() {
                if (videoObj.videoWidth > 0 || triesLeft < 0) {
                    easyrtc.nativeVideoWidth = videoObj.videoWidth;
                    easyrtc.nativeVideoHeight = videoObj.videoHeight;
                    if (easyrtc.videoFeatures.mandatory &&
                            easyrtc.videoFeatures.mandatory.minHeight &&
                            (easyrtc.nativeVideoHeight !== easyrtc.videoFeatures.mandatory.minHeight ||
                                    easyrtc.nativeVideoWidth !== easyrtc.videoFeatures.mandatory.minWidth)) {
                        easyrtc.showError(easyrtc.errCodes.MEDIA_WARNING,
                                easyrtc.format(easyrtc.constantStrings.resolutionWarning,
                                easyrtc.videoFeatures.mandatory.minWidth, easyrtc.videoFeatures.mandatory.minHeight,
                                easyrtc.nativeVideoWidth, easyrtc.nativeVideoHeight));
                    }
                    easyrtc.setVideoObjectSrc(videoObj, "");
                    if (videoObj.removeNode) {
                        videoObj.removeNode(true);
                    }
                    else {
                        ele = document.createElement('div');
                        ele.appendChild(videoObj);
                        ele.removeChild(videoObj);
                    }

                    easyrtc.updateConfigurationInfo();
                    if (successCallback) {
                        successCallback();
                    }
                }
                else {
                    triesLeft -= 1;
                    setTimeout(tryToGetSize, 100);
                }
            };
            easyrtc.setVideoObjectSrc(videoObj, stream);
            tryToGetSize();
        }
        else {
            easyrtc.updateConfigurationInfo();
            if (successCallback) {
                successCallback();
            }
        }
    };
	
    /** @private
     * @param {String} error
     */
    var onUserMediaError = function(error) {
        console.log("getusermedia failed");
        if (easyrtc.debugPrinter) {
            easyrtc.debugPrinter("failed to get local media");
        }
        if (errorCallback) {
            errorCallback(easyrtc.errCodes.MEDIA_ERR, "Failed to get access to local media. Error code was " + error.code + ".");
        }
        easyrtc.localStream = null;
        easyrtc.haveAudioVideo = {
            audio: false,
            video: false
        };
        easyrtc.updateConfigurationInfo();
    };
    if (!easyrtc.audioEnabled && !easyrtc.videoEnabled) {
        onUserMediaError("At least one of audio and video must be provided");
        return;
    }
 /** @private */
    easyrtc.haveAudioVideo = {
        audio: easyrtc.audioEnabled,
        video: easyrtc.videoEnabled
    };

    function getCurrentTime() {
        return (new Date()).getTime();
    }

    var firstCallTime;
    if (easyrtc.videoEnabled || easyrtc.audioEnabled) {
        //
        // getUserMedia sopm fails the first time I call it. I suspect it's a page loading
        // issue. So I'm going to try adding a 3 second delay to allow things to settle down first.
        // In addition, I'm going to try again after 3 seconds.
        //

        function tryAgain(error) {
            var currentTime = getCurrentTime();
            if (currentTime < firstCallTime + 1000) {
                console.log("Trying getUserMedia a second time");
                setTimeout(function() {
                    getUserMedia(mode, onUserMediaSuccess, onUserMediaError);
                }, 3000);
            }
            else {
                onUserMediaError(error);
            }
        }

        function tryAgain2(e) {
            console.log("Trying getUserMedia a second time");
            try {
                getUserMedia(mode, onUserMediaSuccess, onUserMediaError);
            }
            catch (e) {
                onUserMediaError(e);
            }
        }

        setTimeout(function() {
            try {
                firstCallTime = getCurrentTime();
                getUserMedia(mode, onUserMediaSuccess, tryAgain);
            } catch (e) {
                setTimeout(tryAgain2, 2500);
            }
        }, 1000);
    }
    else {
        onUserMediaSuccess(null);
    }
};

1440
	
/**
 * easyrtc.setAcceptChecker sets the callback used to decide whether to accept or reject an incoming call.
 * @param {Function} acceptCheck takes the arguments (callerEasyrtcid, function():boolean ){}
 * The acceptCheck callback is passed (as it's second argument) a function that should be called with either
 * a true value (accept the call) or false value( reject the call).
 * @example
 *      easyrtc.setAcceptChecker( function(easyrtcid, acceptor){
 *           if( easyrtc.idToName(easyrtcid) === 'Fred' ){
 *              acceptor(true);
 *           }
 *           else if( easyrtc.idToName(easyrtcid) === 'Barney' ){
 *              setTimeout( function(){ acceptor(true)}, 10000);
 *           }
 *           else{
 *              acceptor(false);
 *           }
 *      });
 */
easyrtc.setAcceptChecker = function(acceptCheck) {
    easyrtc.acceptCheck = acceptCheck;
};
/**
 * easyrtc.setStreamAcceptor sets a callback to receive media streams from other peers, independent
 * of where the call was initiated (caller or callee).
 * @param {Function} acceptor takes arguments (caller, mediaStream)
 * @example
 *  easyrtc.setStreamAcceptor(function(easyrtcid, stream){
 *     document.getElementById('callerName').innerHTML = easyrtc.idToName(easyrtcid);
 *     easyrtc.setVideoObjectSrc( document.getElementById("callerVideo"), stream);
 *  });
 */
easyrtc.setStreamAcceptor = function(acceptor) {
    easyrtc.streamAcceptor = acceptor;
};
/** Sets the easyrtc.onError field to a user specified function.
 * @param {Function} errListener takes an object of the form {errorCode: String, errorText: String}
 * @example
 *    easyrtc.setOnError( function(errorObject){
 *        document.getElementById("errMessageDiv").innerHTML += errorObject.errorText;
 *    });
 */
easyrtc.setOnError = function(errListener) {
    easyrtc.onError = errListener;
};
	
	1483
	
	
	/**
 * Sets the bandwidth for sending video data.
 * Setting the rate too low will cause connection attempts to fail. 40 is probably good lower limit.
 * The default is 50. A value of zero will remove bandwidth limits.
 * @param {Number} kbitsPerSecond is rate in kilobits per second.
 * @example
 *    easyrtc.setVideoBandwidth( 40);
 */
easyrtc.setVideoBandwidth = function(kbitsPerSecond) {
    if (easyrtc.debugPrinter) {
        easyrtc.debugPrinter("video bandwidth set to " + kbitsPerSecond + " kbps");
    }
    if (kbitsPerSecond > 0) {
        easyrtc.videoBandwidthString = "b=AS:" + kbitsPerSecond;
    }
    else {
        easyrtc.videoBandwidthString = "";
    }
};


/**
 * Sets the user name associated with the connection.
 * @param {String} username must obey standard identifier conventions.
 * @returns {Boolean} true if the call succeeded, false if the username was invalid.
 * @example
 *    if( !easyrtc.setUsername("JohnSmith") ){
 *        console.error("bad user name);
 *
 */
easyrtc.setUsername = function(username) {

    if (easyrtc.isNameValid(username)) {
        easyrtc.username = username;
        return true;
    }
    else {
        easyrtc.showError(easyrtc.errCodes.BAD_NAME, easyrtc.format(easyrtc.constantStrings.badUserName, username));
        return false;
    }
};

1668

/**
 * Get an array of easyrtcids that are using a particular username
 * @param {String} username - the username of interest.
 * @param {String} room - an optional room name argument limiting results to a particular room.
 * @returns an array of {easyrtcid:id, roomName: roomName}.
 */
easyrtc.usernameToIds = function(username, room) {
    var results = [];
    var id, roomname;
    for (roomname in easyrtc.lastLoggedInList) {
        if (room && roomname !== room) {
            continue;
        }
        for (id in easyrtc.lastLoggedInList[roomname]) {
            if (easyrtc.lastLoggedInList[roomname][id].username === username) {
                results.push({
                    easyrtcid: id,
                    roomName: roomname
                });
            }
        }
    }
    return results;
};



/**
 * Set the authentication credential if needed.
 * @param {Object} credential - a JSONifiable object.
 */
/*easyrtc.setCredential = function(credential) {
    try {
        JSON.stringify(credential);
        easyrtc.credential = credential;
        return true;
    }
    catch (oops) {
        easyrtc.showError(easyrtc.errCodes.BAD_CREDENTIAL, "easyrtc.setCredential passed a non-JSON-able object");
        throw "easyrtc.setCredential passed a non-JSON-able object";
    }
};*/


/**
 * Convert an easyrtcid to a user name. This is useful for labeling buttons and messages
 * regarding peers.
 * @param {String} easyrtcid
 * @return {String} the username associated with the easyrtcid, or the easyrtcid if there is
 * no associated username.
 * @example
 *    console.log(easyrtcid + " is actually " + easyrtc.idToName(easyrtcid));
 */
easyrtc.idToName = function(easyrtcid) {
    var roomname;
    for (roomname in easyrtc.lastLoggedInList) {
        if (easyrtc.lastLoggedInList[roomname][easyrtcid]) {
            if (easyrtc.lastLoggedInList[roomname][easyrtcid].username) {
                return easyrtc.lastLoggedInList[roomname][easyrtcid].username;
            }
        }
    }
    return easyrtcid;
};


/**
 * Connects to the EasyRTC signaling server. You must connect before trying to
 * call other users.
 * @param {String} applicationName is a string that identifies the application so that different applications can have different
 *        lists of users. Note that the server configuration specifies a regular expression that is used to check application names 
 *        for validity. The default pattern is that of an identifier, spaces are not allowed.
 * @param {Function} successCallback (easyrtcId, roomOwner) - is called on successful connect. easyrtcId is the
 *   unique name that the client is known to the server by. A client usually only needs it's own easyrtcId for debugging purposes.
 *       roomOwner is true if the user is the owner of a room. It's value is random if the user is in multiple rooms.
 * @param {Function} errorCallback (errorCode, errorText) - is called on unsuccessful connect. if null, an alert is called instead.
 *  The errorCode takes it's value from easyrtc.errCodes.
 * @example
 *   easyrtc.connect("mychat_app",
 *                   function(easyrtcid, roomOwner){
 *                       if( roomOwner){ console.log("I'm the room owner"); }
 *                       console.log("my id is " + easyrtcid);
 *                   },
 *                   function(errorText){
 *                       console.log("failed to connect ", erFrText);
 *                   });
 */
easyrtc.connect = function(applicationName, successCallback, errorCallback) {
    easyrtc.pc_config = {};
    easyrtc.closedChannel = null;
    if (easyrtc.webSocket) {
        console.error("Developer error: attempt to connect when already connected to socket server");
        return;
    }


    easyrtc.fields = {
        rooms: {},
        application: {},
        connection: {}
    };
    if (easyrtc.debugPrinter) {
        easyrtc.debugPrinter("attempt to connect to WebRTC signalling server with application name=" + applicationName);
    }

    function isEmptyObj(obj) {
        if (obj === null || obj === undefined) {
            return true;
        }
        var key;
        for (key in obj) {
            return false;
        }
        return true;
    }
//
// easyrtc.disconnect performs a clean disconnection of the client from the server.
//
    easyrtc.disconnectBody = function() {
        var key;
        easyrtc.loggingOut = true;
        easyrtc.disconnecting = true;
        easyrtc.closedChannel = easyrtc.webSocket;
        if (easyrtc.webSocketConnected) {
            easyrtc.webSocket.close();
            easyrtc.webSocketConnected = false;
        }
        easyrtc.hangupAll();
        if (easyrtc.roomOccupantListener) {
            for (key in easyrtc.lastLoggedInList) {
                easyrtc.roomOccupantListener(key, {}, false);
            }
        }
        easyrtc.emitEvent("roomOccupant", {});
        easyrtc.loggingOut = false;
        easyrtc.disconnecting = false;
        easyrtc.oldConfig = {};
    };
    easyrtc.disconnect = function() {

        if (easyrtc.debugPrinter) {
            easyrtc.debugPrinter("attempt to disconnect from WebRTC signalling server");
        }

        easyrtc.disconnecting = true;
        easyrtc.hangupAll();
        easyrtc.loggingOut = true;

		1926
		 //
        // The hangupAll may try to send configuration information back to the server.
        // Collecting that information is asynchronous, we don't actually close the
        // connection until it's had a chance to be sent. We allocate 100ms for collecting
        // the info, so 250ms should be sufficient for the disconnecting.
        //
		
		
		 setTimeout(function() {
            if (easyrtc.webSocket) {
                try {
                    easyrtc.webSocket.disconnect();
                } catch (e) {
                    // we don't really care if this fails.
                }

                easyrtc.closedChannel = easyrtc.webSocket;
                easyrtc.webSocket = 0;
            }
            easyrtc.loggingOut = false;
            easyrtc.disconnecting = false;
            if (easyrtc.roomOccupantListener) {
                easyrtc.roomOccupantListener(null, {}, false);
            }
            easyrtc.emitEvent("roomOccupant", {});
            easyrtc.oldConfig = {};
        }, 250);
    };
    if (errorCallback === null) {
        errorCallback = function(errorCode, errorText) {
            console.error("easyrtc.connect: " + errorText);
        };
    }
1958

    //
    // This function is used to send WebRTC signaling messages to another client. These messages all the form:
    //   destUser: someid or null
    //   msgType: one of ["offer"/"answer"/"candidate","reject","hangup", "getRoomList"]
    //   msgData: either null or an SDP record
    //   successCallback: a function with the signature  function(msgType, wholeMsg);
    //   errorCallback: a function with signature function(errorCode, errorText)
    //
    function sendSignalling(destUser, msgType, msgData, successCallback, errorCallback) {
        if (!easyrtc.webSocket) {
            throw "Attempt to send message without a valid connection to the server.";
        }
        else {
            var dataToShip = {
                msgType: msgType
            };
            if (destUser) {
                dataToShip.targetEasyrtcid = destUser;
            }
            if (msgData) {
                dataToShip.msgData = msgData;
            }

            if (easyrtc.debugPrinter) {
                easyrtc.debugPrinter("sending socket message " + JSON.stringify(dataToShip));
            }
            easyrtc.webSocket.json.emit("easyrtcCmd", dataToShip,
                    function(ackmsg) {
                        if (ackmsg.msgType !== "error") {
                            if (successCallback) {
                                successCallback(ackmsg.msgType, ackmsg.msgData);
                            }
                        }
                        else {
                            if (errorCallback) {
                                errorCallback(ackmsg.msgData.errorCode, ackmsg.msgData.errorText);
                            }
                            else {
                                easyrtc.showError(ackmsg.msgData.errorCode, ackmsg.msgData.errorText);
                            }
                        }
                    }
            );
        }
    }

    easyrtc.sendSignalling = sendSignalling;
    var totalLengthSent = 0;
	
	2007

	 /**
     * Check if the client has a peer-2-peer connection to another user.
     * The return values are text strings so you can use them in debugging output.
     *  @param {String} otherUser - the easyrtcid of the other user.
     *  @return {String} one of the following values: easyrtc.NOT_CONNECTED, easyrtc.BECOMING_CONNECTED, easyrtc.IS_CONNECTED
     *  @example
     *     if( easyrtc.getConnectStatus(otherEasyrtcid) == easyrtc.NOT_CONNECTED ){
     *         easyrtc.call(otherEasyrtcid,
     *                  function(){ console.log("success"); },
     *                  function(){ console.log("failure"); });
     *     }
     */
	 
	 easyrtc.buildPeerConstraints = function() {
        var options = [];
        options.push({'DtlsSrtpKeyAgreement': 'true'}); // for interoperability
        return {optional: options};
    };

	2273
	
	 /**
     *  Initiates a call to another user. If it succeeds, the streamAcceptor callback will be called.
     * @param {String} otherUser - the easyrtcid of the peer being called.
     * @param {Function} callSuccessCB (otherCaller, mediaType) - is called when the datachannel is established or the mediastream is established. mediaType will have a value of "audiovideo" or "datachannel"
     * @param {Function} callFailureCB (errorCode, errMessage) - is called if there was a system error interfering with the call.
     * @param {Function} wasAcceptedCB (wasAccepted:boolean,otherUser:string) - is called when a call is accepted or rejected by another party. It can be left null.
     * @example
     *    easyrtc.call( otherEasyrtcid,
     *        function(easyrtcid, mediaType){
     *           console.log("Got mediatype " + mediaType + " from " + easyrtc.idToName(easyrtcid));
     *        },
     *        function(errorCode, errMessage){
     *           console.log("call to  " + easyrtc.idToName(otherEasyrtcid) + " failed:" + errMessage);
     *        },
     *        function(wasAccepted, easyrtcid){
     *            if( wasAccepted ){
     *               console.log("call accepted by " + easyrtc.idToName(easyrtcid));
     *            }
     *            else{
     *                console.log("call rejected" + easyrtc.idToName(easyrtcid));
     *            }
     *        });
     */
    easyrtc.call = function(otherUser, callSuccessCB, callFailureCB, wasAcceptedCB) {

        if (easyrtc.debugPrinter) {
            easyrtc.debugPrinter("initiating peer to peer call to " + otherUser +
                    " audio=" + easyrtc.audioEnabled +
                    " video=" + easyrtc.videoEnabled +
                    " data=" + easyrtc.dataEnabled);
        }

        var i, message;
        //
        // If we are sharing audio/video and we haven't allocated the local media stream yet,
        // we'll do so, recalling ourself on success.
        //
        if (easyrtc.localStream === null && (easyrtc.audioEnabled || easyrtc.videoEnabled)) {
            easyrtc.initMediaSource(function() {
                easyrtc.call(otherUser, callSuccessCB, callFailureCB, wasAcceptedCB);
            }, callFailureCB);
            return;
        }

        if (!easyrtc.webSocket) {
            message = "Attempt to make a call prior to connecting to service";
            if (easyrtc.debugPrinter) {
                easyrtc.debugPrinter(message);
            }
            throw message;
        }

        //
        // If B calls A, and then A calls B before accepting, then A should treat the attempt to
        // call B as a positive offer to B's offer.
        //
        if (easyrtc.offersPending[otherUser]) {
            wasAcceptedCB(true);
            doAnswer(otherUser, easyrtc.offersPending[otherUser]);
            delete easyrtc.offersPending[otherUser];
            easyrtc.callCancelled(otherUser, false);
            return;
        }

        // do we already have a pending call?
        if (typeof easyrtc.acceptancePending[otherUser] !== 'undefined') {
            message = "Call already pending acceptance";
            if (easyrtc.debugPrinter) {
                easyrtc.debugPrinter(message);
            }
            callFailureCB(easyrtc.errCodes.ALREADY_CONNECTED, message);
            return;
        }

        easyrtc.acceptancePending[otherUser] = true;
        var pc = buildPeerConnection(otherUser, true, callFailureCB);
        if (!pc) {
            message = "buildPeerConnection failed, call not completed";
            if (easyrtc.debugPrinter) {
                easyrtc.debugPrinter(message);
            }
            throw message;
        }

        easyrtc.peerConns[otherUser].callSuccessCB = callSuccessCB;
        easyrtc.peerConns[otherUser].callFailureCB = callFailureCB;
        easyrtc.peerConns[otherUser].wasAcceptedCB = wasAcceptedCB;
        var peerConnObj = easyrtc.peerConns[otherUser];
        var setLocalAndSendMessage0 = function(sessionDescription) {
            if (peerConnObj.cancelled) {
                return;
            }
            var sendOffer = function() {

                sendSignalling(otherUser, "offer", sessionDescription, null, callFailureCB);
            };
            pc.setLocalDescription(sessionDescription, sendOffer,
                    function(errorText) {
                        callFailureCB(easyrtc.errCodes.CALL_ERR, errorText);
                    });
        };
        setTimeout(function() {
            pc.createOffer(setLocalAndSendMessage0, function(errorObj) {
                callFailureCB(easyrtc.errCodes.CALL_ERR, JSON.stringify(errObj));
            },
                    easyrtc.mediaConstraints);
        }, 100);
    };
  /*  function limitBandWidth(sd) {
        var i, j;
        if (easyrtc.videoBandwidthString !== "") {
            var pieces = sd.sdp.split('\n');
            for (i = pieces.length - 1; i >= 0; i--) {
                if (pieces[i].indexOf("m=video") === 0) {
                    for (j = i; j < i + 10 && pieces[j].indexOf("a=") === -1 &&
                            pieces[j].indexOf("k=") === -1; j++) {
                    }
                    pieces.splice(j, 0, (easyrtc.videoBandwidthString + "\r"));
                }
            }
            sd.sdp = pieces.join("\n");
        }
    }
*/


  function hangupBody(otherUser) {
        if (easyrtc.debugPrinter) {
            easyrtc.debugPrinter("Hanging up on " + otherUser);
        }
        clearQueuedMessages(otherUser);
        if (easyrtc.peerConns[otherUser]) {
            if (easyrtc.peerConns[otherUser].startedAV) {
                try {
                    easyrtc.peerConns[otherUser].pc.close();
                } catch (ignoredError) {
                }

                if (easyrtc.onStreamClosed) {
                    easyrtc.onStreamClosed(otherUser);
                }
            }

            easyrtc.peerConns[otherUser].cancelled = true;
            delete easyrtc.peerConns[otherUser];
            if (easyrtc.webSocket) {
                sendSignalling(otherUser, "hangup", null, function() {
                }, function(errorCode, errorText) {
                    if (easyrtc.debugPrinter) {
                        debugPrinter("hangup failed:" + errorText);
                    }
                });
            }
            if (easyrtc.acceptancePending[otherUser]) {
                delete easyrtc.acceptancePending[otherUser];
            }
        }
    }

2433

/**
     * Hang up on a particular user or all users.
     *  @param {String} otherUser - the easyrtcid of the person to hang up on.
     *  @example
     *     easyrtc.hangup(someEasyrtcid);
     */
   easyrtc.hangup = function(otherUser) {
        hangupBody(otherUser);
        easyrtc.updateConfigurationInfo();
    };
    /**
     * Hangs up on all current connections.
     * @example
     *    easyrtc.hangupAll();
     */
    easyrtc.hangupAll = function() {

        var sawAConnection = false,
                onHangupSucess = function() {
        },
                onHangupFailure = function(errorCode, errorText) {
            if (easyrtc.debugPrinter) {
                easyrtc.debugPrinter("hangup failed:" + errorText);
            }
        };

        for (var otherUser in easyrtc.peerConns) {

            sawAConnection = true;

            hangupBody(otherUser);

            if (easyrtc.webSocket) {
                easyrtc.sendSignalling(otherUser, "hangup", null, onHangupSucess, onHangupFailure);
            }
        }

        if (sawAConnection) {
            easyrtc.updateConfigurationInfo();
        }
    };
	
	    /**
     * Hangs up on all current connections.
     * @example
     *    easyrtc.hangupAll();
     */
  /*  easyrtc.hangupAll = function() {

        var sawAConnection = false,
                onHangupSucess = function() {
        },
                onHangupFailure = function(errorCode, errorText) {
            if (easyrtc.debugPrinter) {
                easyrtc.debugPrinter("hangup failed:" + errorText);
            }
        };

        for (var otherUser in easyrtc.peerConns) {

            sawAConnection = true;

            hangupBody(otherUser);

            if (easyrtc.webSocket) {
                easyrtc.sendSignalling(otherUser, "hangup", null, onHangupSucess, onHangupFailure);
            }
        }

        if (sawAConnection) {
            easyrtc.updateConfigurationInfo();
        }
    };
*/

2474

 /** Checks to see if data channels work between two peers.
     * @param {String} otherUser - the other peer.
     * @returns {Boolean} true if data channels work and are ready to be used
     *   between the two peers.
     */

    var buildPeerConnection = function(otherUser, isInitiator, failureCB) {
        var pc;
        var message;
        var newPeerConn;

        if (easyrtc.debugPrinter) {
            easyrtc.debugPrinter("building peer connection to " + otherUser);
        }

        //
        // we don't support data channels on chrome versions < 31
        //
        try {
            pc = easyrtc.createRTCPeerConnection(easyrtc.pc_config, easyrtc.buildPeerConstraints());
            if (!pc) {
                message = "Unable to create PeerConnection object, check your ice configuration(" +
                        JSON.stringify(easyrtc.pc_config) + ")";
                if (easyrtc.debugPrinter) {
                    easyrtc.debugPrinter(message);
                }
                throw(message);
            }

            //
            // turn off data channel support if the browser doesn't support it.
            //
         /*   if (easyrtc.dataEnabled && typeof pc.createDataChannel === 'undefined') {
                easyrtc.dataEnabled = false;
            }*/

            pc.onconnection = function() {
                if (easyrtc.debugPrinter) {
                    easyrtc.debugPrinter("onconnection called prematurely");
                }
            };
            newPeerConn = {
                pc: pc,
                candidatesToSend: [],
                startedAV: false,
                isInitiator: isInitiator
            };
            pc.onicecandidate = function(event) {
//                if(easyrtc.debugPrinter){
//                    easyrtc.debugPrinter("saw ice message:\n" + event.candidate);
//                }
                if (newPeerConn.cancelled) {
                    return;
                }
                var candidateData;
                if (event.candidate && easyrtc.peerConns[otherUser]) {
                    candidateData = {
                        type: 'candidate',
                        label: event.candidate.sdpMLineIndex,
                        id: event.candidate.sdpMid,
                        candidate: event.candidate.candidate
                    };

                    //
                    // some candidates include ip addresses of turn servers. we'll want those 
                    // later so we can see if our actual connection uses a turnsever.
                    // The keyword "relay" in the candidate identifies it as referencing a 
                    // turn server. The \d symbol in the regular expression matches a number.
                    // 
                    if (event.candidate.candidate.indexOf("typ relay") > 0) {
                        var ipaddress = event.candidate.candidate.match(/(udp|tcp) \d+ (\d+\.\d+\.\d+\.\d+)/)[2];
                        easyrtc._turnServers[ipaddress] = true;
                    }

                    if (easyrtc.peerConns[otherUser].startedAV) {
                        sendSignalling(otherUser, "candidate", candidateData, null, function() {
                            failureCB(easyrtc.errCodes.PEER_GONE, "Candidate disappeared");
                        });
                    }
                    else {
                        easyrtc.peerConns[otherUser].candidatesToSend.push(candidateData);
                    }
                }
            };
            pc.onaddstream = function(event) {
                if (easyrtc.debugPrinter) {
                    easyrtc.debugPrinter("saw incoming media stream");
                }
                if (newPeerConn.cancelled)
                    return;
                easyrtc.peerConns[otherUser].startedAV = true;
                easyrtc.peerConns[otherUser].sharingAudio = easyrtc.haveAudioVideo.audio;
                easyrtc.peerConns[otherUser].sharingVideo = easyrtc.haveAudioVideo.video;
                easyrtc.peerConns[otherUser].connectTime = new Date().getTime();
                easyrtc.peerConns[otherUser].stream = event.stream;
                if (easyrtc.peerConns[otherUser].callSuccessCB) {
                    if (easyrtc.peerConns[otherUser].sharingAudio || easyrtc.peerConns[otherUser].sharingVideo) {
                        easyrtc.peerConns[otherUser].callSuccessCB(otherUser, "audiovideo");
                    }
                }
                if (easyrtc.audioEnabled || easyrtc.videoEnabled) {
                    updateConfiguration();
                }
                if (easyrtc.streamAcceptor) {
                    easyrtc.streamAcceptor(otherUser, event.stream);
                }
            };
            pc.onremovestream = function(event) {
                if (easyrtc.debugPrinter) {
                    easyrtc.debugPrinter("saw remove on remote media stream");
                }

                if (easyrtc.peerConns[otherUser]) {
                    easyrtc.peerConns[otherUser].stream = null;
                    if (easyrtc.onStreamClosed) {
                        easyrtc.onStreamClosed(otherUser);
                    }
//                  delete easyrtc.peerConns[otherUser];
                    easyrtc.updateConfigurationInfo();
                }

            };
            easyrtc.peerConns[otherUser] = newPeerConn;
        } catch (e) {
            if (easyrtc.debugPrinter) {
                easyrtc.debugPrinter(JSON.stringify(e));
            }
            failureCB(easyrtc.errCodes.SYSTEM_ERR, e.message);
            return null;
        }

        if (easyrtc.forwardStreamEnabled) {
            if (!easyrtc.localStream) {
                makeLocalStreamFromRemoteStream();
            }
            if (easyrtc.localStream) {
                pc.addStream(easyrtc.localStream);
            }
        }
        else if (easyrtc.videoEnabled || easyrtc.audioEnabled) {
            if (easyrtc.localStream === null) {
                message = "Application program error: attempt to share audio or video before calling easyrtc.initMediaSource.";
                if (easyrtc.debugPrinter) {
                    easyrtc.debugPrinter(message);
                }
                easyrtc.showError(easyrtc.errCodes.DEVELOPER_ERR, message);
                console.error(message);
            }
            else {
                if (easyrtc.debugPrinter) {
                    easyrtc.debugPrinter("adding local media stream to peer connection");
                }
                pc.addStream(easyrtc.localStream);
            }
        }

        //
        // This function handles data channel message events.
        //
        /*function dataChannelMessageHandler(event) {
            if (easyrtc.debugPrinter) {
                easyrtc.debugPrinter("saw dataChannel.onmessage event: " + JSON.stringify(event.data));
            }

            if (event.data === "dataChannelPrimed") {
                easyrtc.sendDataWS(otherUser, "dataChannelPrimed", "");
            }
            else {
                //
                // Chrome and Firefox Interop is passing a event with a strange data="", perhaps
                // as it's own form of priming message. Comparing the data against "" doesn't
                // work, so I'm going with parsing and trapping the parse error.
                // 
                try {
                    var msg = JSON.parse(event.data);
                    if (msg) {
                        easyrtc.receivePeerDistribute(otherUser, msg, null);
                    }
                }
                catch (oops) {
                }
            }
        }

        function initOutGoingChannel(otherUser) {
            if (easyrtc.debugPrinter) {
                easyrtc.debugPrinter("saw initOutgoingChannel call");
            }
            var dataChannel = pc.createDataChannel(easyrtc.datachannelName, easyrtc.getDatachannelConstraints());
            easyrtc.peerConns[otherUser].dataChannelS = dataChannel;
            easyrtc.peerConns[otherUser].dataChannelR = dataChannel;
            dataChannel.onmessage = dataChannelMessageHandler;


            dataChannel.onopen = function(event) {
                if (easyrtc.debugPrinter) {
                    easyrtc.debugPrinter("saw dataChannel.onopen event");
                }
                if (easyrtc.peerConns[otherUser]) {
                    dataChannel.send("dataChannelPrimed");
                }
            };



            dataChannel.onclose = function(event) {
                if (easyrtc.debugPrinter) {
                    easyrtc.debugPrinter("saw dataChannelS.onclose event");
                }
                if (easyrtc.peerConns[otherUser]) {
                    easyrtc.peerConns[otherUser].dataChannelReady = false;
                    delete easyrtc.peerConns[otherUser].dataChannelS;
                }
                if (easyrtc.onDataChannelClose) {
                    easyrtc.onDataChannelClose(otherUser);
                }

                easyrtc.updateConfigurationInfo();
            };
        }

        function initIncomingChannel(otherUser) {
            if (easyrtc.debugPrinter) {
                easyrtc.debugPrinter("initializing incoming channel handler for " + otherUser);
            }

            easyrtc.peerConns[otherUser].pc.ondatachannel = function(event) {

                if (easyrtc.debugPrinter) {
                    easyrtc.debugPrinter("saw incoming data channel");
                }

                var dataChannel = event.channel;
                easyrtc.peerConns[otherUser].dataChannelR = dataChannel;

                easyrtc.peerConns[otherUser].dataChannelS = dataChannel;
                easyrtc.peerConns[otherUser].dataChannelReady = true;
                dataChannel.onmessage = dataChannelMessageHandler;
                dataChannel.onclose = function(event) {
                    if (easyrtc.debugPrinter) {
                        easyrtc.debugPrinter("saw dataChannelR.onclose event");
                    }
                    if (easyrtc.peerConns[otherUser]) {
                        easyrtc.peerConns[otherUser].dataChannelReady = false;
                        delete easyrtc.peerConns[otherUser].dataChannelR;
                    }
                    if (easyrtc.onDataChannelClose) {
                        easyrtc.onDataChannelClose(otherUser);
                    }

                    easyrtc.updateConfigurationInfo();
                };

                dataChannel.onopen = function(event) {
                    if (easyrtc.debugPrinter) {
                        easyrtc.debugPrinter("saw dataChannel.onopen event");
                    }
                    if (easyrtc.peerConns[otherUser]) {
                        dataChannel.send("dataChannelPrimed");
                    }
                };

            };
        }
*/
        //
        //  added for interoperability
        //
       /* var doDataChannels = easyrtc.dataEnabled;
        if (doDataChannels) {

            // check if both sides have the same browser and versions 
        }

        if (doDataChannels) {
            easyrtc.setPeerListener(function() {
                easyrtc.peerConns[otherUser].dataChannelReady = true;
                if (easyrtc.peerConns[otherUser].callSuccessCB) {
                    easyrtc.peerConns[otherUser].callSuccessCB(otherUser, "datachannel");
                }
                if (easyrtc.onDataChannelOpen) {
                    easyrtc.onDataChannelOpen(otherUser, true);
                }
                easyrtc.updateConfigurationInfo();

            }, "dataChannelPrimed", otherUser);

            if (isInitiator) {
                try {

                    initOutGoingChannel(otherUser);
                } catch (channelErrorEvent) {
                    console.log("failed to init outgoing channel");
                    failureCB(easyrtc.errCodes.SYSTEM_ERR,
                            easyrtc.formatError(channelErrorEvent));
                }
            }
            if (!isInitiator) {
                initIncomingChannel(otherUser);
            }
        }
*/
        /*pc.onconnection = function() {
            if (easyrtc.debugPrinter) {
                easyrtc.debugPrinter("setup pc.onconnection ");
            }
        };*/
        return pc;
    };
	2802
	
	
	
	
	  var queuedMessages = {};
    var clearQueuedMessages = function(caller) {
        queuedMessages[caller] = {
            candidates: []
        };
    };

    function processConnectedList(connectedList) {
        var i;
        for (i in easyrtc.peerConns) {
            if (typeof connectedList[i] === 'undefined') {
                if (easyrtc.peerConns[i].startedAV) {
                    onRemoteHangup(i);
                    clearQueuedMessages(i);
                }
            }
        }
    }

    function processOccupantList(roomName, list) {
        var myInfo = null;
        easyrtc.reducedList = {};
        var id;
        for (id in list) {
            if (id !== easyrtc.myEasyrtcid) {
                easyrtc.reducedList[id] = list[id];
            }
            else {
                myInfo = list[id];
            }
        }
        processConnectedList(easyrtc.reducedList);
        if (easyrtc.roomOccupantListener) {
            easyrtc.roomOccupantListener(roomName, easyrtc.reducedList, myInfo);
        }
    }

    var onChannelMsg = function(msg) {

        var targeting = {};
        if (msg.targetEasyrtcid) {
            targeting.targetEasyrtcid = msg.targetEasyrtcid;
        }
        if (msg.targetRoom) {
            targeting.targetRoom = msg.targetRoom;
        }
        if (msg.targetGroup) {
            targeting.targetGroup = msg.targetGroup;
        }
        if (msg.senderEasyrtcid) {
            easyrtc.receivePeerDistribute(msg.senderEasyrtcid, msg, targeting);
        }
        else {
            if (easyrtc.receiveServerCB) {
                easyrtc.receiveServerCB(msg.msgType, msg.msgData, targeting);
            }
            else {
                console.log("Unhandled server message " + JSON.stringify(msg));
            }
        }
    };

    var onChannelCmd = function(msg, ackAcceptorFn) {

        if (easyrtc.debugPrinter) {
            easyrtc.debugPrinter("received message from socket server=" + JSON.stringify(msg));
        }

        var caller = msg.senderEasyrtcid;
        var msgType = msg.msgType;
        var msgData = msg.msgData;
        var pc;

        if (easyrtc.debugPrinter) {
            easyrtc.debugPrinter('received message of type ' + msgType);
        }

        if (typeof queuedMessages[caller] === "undefined") {
            clearQueuedMessages(caller);
        }

        var processCandidateBody = function(caller, msgData) {
            var candidate = null;
            if (window.mozRTCIceCandidate) {
                candidate = new mozRTCIceCandidate({
                    sdpMLineIndex: msgData.label,
                    candidate: msgData.candidate
                });
            }
            else {
                candidate = new RTCIceCandidate({
                    sdpMLineIndex: msgData.label,
                    candidate: msgData.candidate
                });
            }
            pc = easyrtc.peerConns[caller].pc;
            pc.addIceCandidate(candidate);

            if (msgData.candidate.indexOf("typ relay") > 0) {
                var ipaddress = msgData.candidate.match(/(udp|tcp) \d+ (\d+\.\d+\.\d+\.\d+)/)[1];
                easyrtc._turnServers[ipaddress] = true;
            }
        };

        var flushCachedCandidates = function(caller) {
            var i;
            if (queuedMessages[caller]) {
                for (i = 0; i < queuedMessages[caller].candidates.length; i++) {
                    processCandidateBody(caller, queuedMessages[caller].candidates[i]);
                }
                delete queuedMessages[caller];
            }
        };

        var processOffer = function(caller, msgData) {

            var helper = function(wasAccepted) {
                if (easyrtc.debugPrinter) {
                    easyrtc.debugPrinter("offer accept=" + wasAccepted);
                }
                delete easyrtc.offersPending[caller];
                if (wasAccepted) {
                    doAnswer(caller, msgData);
                    flushCachedCandidates(caller);
                }
                else {
                    sendSignalling(caller, "reject", null, null, null);
                    clearQueuedMessages(caller);
                }
            };
            //
            // There is a very rare case of two callers sending each other offers
            // before receiving the others offer. In such a case, the caller with the
            // greater valued easyrtcid will delete its pending call information and do a
            // simple answer to the other caller's offer.
            //
            if (easyrtc.acceptancePending[caller] && caller < easyrtc.myEasyrtcid) {
                delete easyrtc.acceptancePending[caller];
                if (queuedMessages[caller]) {
                    delete queuedMessages[caller];
                }
                if (easyrtc.peerConns[caller].wasAcceptedCB) {
                    easyrtc.peerConns[caller].wasAcceptedCB(true, caller);
                }
                delete easyrtc.peerConns[caller];
                helper(true);
                return;
            }

            easyrtc.offersPending[caller] = msgData;
            if (!easyrtc.acceptCheck) {
                helper(true);
            }
            else {
                easyrtc.acceptCheck(caller, helper);
            }
        };

        function processReject(caller) {
            delete easyrtc.acceptancePending[caller];
            if (queuedMessages[caller]) {
                delete queuedMessages[caller];
            }
            if (easyrtc.peerConns[caller]) {
                if (easyrtc.peerConns[caller].wasAcceptedCB) {
                    easyrtc.peerConns[caller].wasAcceptedCB(false, caller);
                }
                delete easyrtc.peerConns[caller];
            }
        }

        function processAnswer(caller, msgData) {

            delete easyrtc.acceptancePending[caller];
            if (easyrtc.peerConns[caller].wasAcceptedCB) {
                easyrtc.peerConns[caller].wasAcceptedCB(true, caller);
            }

            var onSignalSuccess = function() {

            };

            var onSignalFailure = function(errorCode, errorText) {
                if (easyrtc.peerConns[caller]) {
                    delete easyrtc.peerConns[caller];
                }
                easyrtc.showError(errorCode, errorText);
            };
            var i;
            easyrtc.peerConns[caller].startedAV = true;
            for (i = 0; i < easyrtc.peerConns[caller].candidatesToSend.length; i++) {
                sendSignalling(
                        caller,
                        "candidate",
                        easyrtc.peerConns[caller].candidatesToSend[i],
                        onSignalSuccess,
                        onSignalFailure
                        );
            }

            pc = easyrtc.peerConns[caller].pc;
            var sd = null;
            if (window.mozRTCSessionDescription) {
                sd = new mozRTCSessionDescription(msgData);
            }
            else {
                sd = new RTCSessionDescription(msgData);
            }
            if (!sd) {
                throw "Could not create the RTCSessionDescription";
            }

            if (easyrtc.debugPrinter) {
                easyrtc.debugPrinter("about to call initiating setRemoteDescription");
            }
            try {
                pc.setRemoteDescription(sd, function() {
                    if (pc.connectDataConnection) {
                        if (easyrtc.debugPrinter) {
                            easyrtc.debugPrinter("calling connectDataConnection(5001,5002)");
                        }
                        pc.connectDataConnection(5001, 5002); // these are like ids for data channels
                    }
                });
            } catch (smdException) {
                console.log("setRemoteDescription failed ", smdException);
            }
            flushCachedCandidates(caller);
        }

        function processCandidateQueue(caller, msgData) {

            if (easyrtc.peerConns[caller] && easyrtc.peerConns[caller].startedAV) {
                processCandidateBody(caller, msgData);
            }
            else {
                if (!easyrtc.peerConns[caller]) {
                    queuedMessages[caller] = {
                        candidates: []
                    };
                }
                queuedMessages[caller].candidates.push(msgData);
            }
        }

        switch (msgType) {
            case "sessionData":
                processSessionData(msgData.sessionData);
                break;
            case "roomData":
                processRoomData(msgData.roomData);
                break;
            case "iceConfig":
                processIceConfig(msgData.iceConfig);
                break;
            case "forwardToUrl":
                if (msgData.newWindow) {
                    window.open(msgData.forwardToUrl.url);
                }
                else {
                    window.location.href = msgData.forwardToUrl.url;
                }
                break;
            case "offer":
                processOffer(caller, msgData);
                break;
            case "reject":
                processReject(caller);
                break;
            case "answer":
                processAnswer(caller, msgData);
                break;
            case "candidate":
                processCandidateQueue(caller, msgData);
                break;
            case "hangup":
                onRemoteHangup(caller);
                clearQueuedMessages(caller);
                break;
            case "error":
                easyrtc.showError(msg.errorCode, msg.errorText);
                break;
            default:
                console.error("received unknown message type from server, msgType is " + msgType);
                return;
        }

        if (ackAcceptorFn) {
            ackAcceptorFn(easyrtc.ackMessage);
        }
    };

    if (!window.io) {
        easyrtc.onError("Your HTML has not included the socket.io.js library");
    }

    function connectToWSServer(successCallback, errorCallback) {
        var i;
        if (!easyrtc.webSocket) {
            easyrtc.webSocket = io.connect(easyrtc.serverPath, {
                'connect timeout': 10000,
                'force new connection': true
            });
            if (!easyrtc.webSocket) {
                throw "io.connect failed";
            }
        }
        else {
            for (i in easyrtc.websocketListeners) {
                easyrtc.webSocket.removeEventListener(easyrtc.websocketListeners[i].event,
                        easyrtc.websocketListeners[i].handler);
            }
        }
        easyrtc.websocketListeners = [];
        function addSocketListener(event, handler) {
            easyrtc.webSocket.on(event, handler);
            easyrtc.websocketListeners.push({event: event, handler: handler});
        }
        addSocketListener("close", function(event) {
            console.log("the web socket closed");
        });
        addSocketListener('error', function(event) {
            function handleErrorEvent() {
                if (easyrtc.myEasyrtcid) {
                    if (easyrtc.webSocket.socket.connected) {
                        easyrtc.showError(easyrtc.errCodes.SIGNAL_ERROR, easyrtc.constantStrings.miscSignalError);
                    }
                    else {
                        /* socket server went down. this will generate a 'disconnect' event as well, so skip this event */
                        console.warn("The connection to the EasyRTC socket server went down. It may come back by itself.");
                    }
                }
                else {
                    errorCallback(easyrtc.errCodes.CONNECT_ERR, easyrtc.constantStrings.noServer);
                }
            }

            setTimeout(handleErrorEvent, 1);
        });
        addSocketListener("connect", function(event) {

            easyrtc.webSocketConnected = true;
            if (!easyrtc.webSocket || !easyrtc.webSocket.socket || !easyrtc.webSocket.socket.sessionid) {
                easyrtc.showError(easyrtc.errCodes.CONNECT_ERR, easyrtc.constantStrings.badsocket);
            }

            if (easyrtc.debugPrinter) {
                easyrtc.debugPrinter("saw socketserver onconnect event");
            }
            if (easyrtc.webSocketConnected) {
                sendAuthenticate(successCallback, errorCallback);
            }
            else {
                errorCallback(easyrtc.errCodes.SIGNAL_ERROR, easyrtc.constantStrings.icf);
            }
        }
        );
        addSocketListener("easyrtcMsg", onChannelMsg);
        addSocketListener("easyrtcCmd", onChannelCmd);
        addSocketListener("disconnect", function(code, reason, wasClean) {
            easyrtc.webSocketConnected = false;
            easyrtc.updateConfigurationInfo = function() {
            }; // dummy update function
            easyrtc.oldConfig = {};
            easyrtc.disconnectBody();
            if (easyrtc.disconnectListener) {
                easyrtc.disconnectListener();
            }
        });
    }
    connectToWSServer(successCallback, errorCallback);

	3294
	
	
	 easyrtc.collectConfigurationInfo = function(forAuthentication) {
        var p2pList = {};
        var i;
        for (i in easyrtc.peerConns) {
            p2pList[i] = {
                connectTime: easyrtc.peerConns[i].connectTime,
                isInitiator: easyrtc.peerConns[i].isInitiator ? true : false
            };
        }

        var newConfig = {
            userSettings: {
                sharingAudio: easyrtc.haveAudioVideo.audio ? true : false,
                sharingVideo: easyrtc.haveAudioVideo.video ? true : false,
                sharingData: easyrtc.dataEnabled ? true : false,
                nativeVideoWidth: easyrtc.nativeVideoWidth,
                nativeVideoHeight: easyrtc.nativeVideoHeight,
                windowWidth: window.innerWidth,
                windowHeight: window.innerHeight,
                screenWidth: window.screen.width,
                screenHeight: window.screen.height,
                cookieEnabled: navigator.cookieEnabled,
                os: navigator.oscpu,
                language: navigator.language
            }
        };
        if (!isEmptyObj(p2pList)) {
            newConfig.p2pList = p2pList;
        }
        return newConfig;
    };
	
    function updateConfiguration() {

        var newConfig = easyrtc.collectConfigurationInfo(false);
        //
        // we need to give the getStats calls a chance to fish out the data.
        // The longest I've seen it take is 5 milliseconds so 100 should be overkill.
        //
        var sendDeltas = function() {
            var alteredData = findDeltas(easyrtc.oldConfig, newConfig);
            //
            // send all the configuration information that changes during the session
            //
            if (easyrtc.debugPrinter) {
                easyrtc.debugPrinter("cfg=" + JSON.stringify(alteredData.added));
            }
            if (easyrtc.webSocket) {
                sendSignalling(null, "setUserCfg", {setUserCfg: alteredData.added}, null, null);
            }
            easyrtc.oldConfig = newConfig;
        };
        if (easyrtc.oldConfig === {}) {
            sendDeltas();
        }
        else {
            setTimeout(sendDeltas, 100);
        }
    }
    easyrtc.updateConfigurationInfo = function() {
        updateConfiguration();
    };
	3418
	
	
	 function processRoomData(roomData) {
        easyrtc.roomData = roomData;
        var roomname;
        var stuffToRemove;
        var stuffToAdd;
        var id, removeId;
        for (roomname in easyrtc.roomData) {
            if (roomData[roomname].roomStatus === "join") {
                if (easyrtc.roomEntryListener) {
                    easyrtc.roomEntryListener(true, roomname);
                }
                if (!(easyrtc.roomJoin[roomname])) {
                    easyrtc.roomJoin[roomname] = roomData[roomname];
                }
            }
            else if (roomData[roomname].roomStatus === "leave") {
                if (easyrtc.roomEntryListener) {
                    easyrtc.roomEntryListener(false, roomname);
                }
                delete easyrtc.roomJoin[roomname];
                continue;
            }

            if (roomData[roomname].clientList) {
                easyrtc.lastLoggedInList[roomname] = roomData[roomname].clientList;
            }
            else if (roomData[roomname].clientListDelta) {
                stuffToAdd = roomData[roomname].clientListDelta.updateClient;
                if (stuffToAdd) {
                    for (id in stuffToAdd) {
                        if (!easyrtc.lastLoggedInList[roomname]) {
                            easyrtc.lastLoggedInList[roomname] = [];
                        }
                        easyrtc.lastLoggedInList[roomname][id] = stuffToAdd[id];
                    }
                }
                stuffToRemove = roomData[roomname].clientListDelta.removeClient;
                if (stuffToRemove) {
                    for (removeId in stuffToRemove) {
                        delete easyrtc.lastLoggedInList[roomname][removeId];
                    }
                }
            }
            if (easyrtc.roomJoin[roomname] && roomData[roomname].field) {
                easyrtc.fields.rooms[roomname] = roomData[roomname].field;
            }
            processOccupantList(roomname, easyrtc.lastLoggedInList[roomname]);
        }
        easyrtc.emitEvent("roomOccupant", easyrtc.lastLoggedInList);
    }

    easyrtc._processRoomData = processRoomData;

    easyrtc.isTurnServer = function(ipaddress) {
        return !!easyrtc._turnServers[ipaddress];
    };

    function processIceConfig(iceConfig) {
        easyrtc.pc_config = {iceServers: []};
        easyrtc._turnServers = {};
        var i;
        var item, fixedItem, parts, username, url, ipaddress;

        for (i = 0; i < iceConfig.iceServers.length; i++) {
            item = iceConfig.iceServers[i];
            if (item.url.indexOf('turn:') === 0) {
                if (item.username) {
                    fixedItem = createIceServer(item.url, item.username, item.credential);
                }
                else {
                    easyrtc.showError("badparam", "Iceserver entry doesn't have a username: " + JSON.stringify(item));
                }
                ipaddress = item.url.split(/[@:&]/g)[1];
                easyrtc._turnServers[ipaddress] = true;
            }
            else { // is stun server entry
                fixedItem = item;
            }
            if (fixedItem) {
                easyrtc.pc_config.iceServers.push(fixedItem);
            }
        }
    }

	3550
	
	 /**
     * Request fresh ice config information from the server.
     * This should be done periodically by long running applications.
     * There are no parameters or return values.
     */
	
	 function processToken(msg) {
        if (easyrtc.debugPrinter) {
            easyrtc.debugPrinter("entered process token");
        }
        var msgData = msg.msgData;
        if (msgData.easyrtcid) {
            easyrtc.myEasyrtcid = msgData.easyrtcid;
        }
        if (msgData.field) {
            easyrtc.fields.connection = msgData.field;
        }
        if (msgData.iceConfig) {
            processIceConfig(msgData.iceConfig);
        }

        if (msgData.sessionData) {
            processSessionData(msgData.sessionData);
        }

        if (msgData.roomData) {
            processRoomData(msgData.roomData);
        }

        if (msgData.application.field) {
            easyrtc.fields.application = msgData.application.field;
        }

    }

    function sendAuthenticate(successCallback, errorCallback) {
        //
        // find our easyrtsid
        //  
        var cookies, target, i;
        var easyrtcsid = null;
        if (easyrtc.cookieId && document.cookie) {
            cookies = document.cookie.split(/[; ]/g);
            target = easyrtc.cookieId + "=";
            for (i in cookies) {
                if (cookies[i].indexOf(target) === 0) {
                    var cookie = cookies[i].substring(target.length);
                    easyrtcsid = cookie;
                }
            }
        }

        if (!easyrtc.roomJoin) {
            easyrtc.roomJoin = {};
        }

        var msgData = {
            apiVersion: easyrtc.apiVersion,
            applicationName: applicationName,
            setUserCfg: easyrtc.collectConfigurationInfo(true)
        };
        if (easyrtc.presenceShow) {
            msgData.setPresence = {show: easyrtc.presenceShow, status: easyrtc.presenceStatus};
        }
        if (easyrtc.username) {
            msgData.username = easyrtc.username;
        }
        if (easyrtc.roomJoin && !isEmptyObj(easyrtc.roomJoin)) {
            msgData.roomJoin = easyrtc.roomJoin;
        }
        if (easyrtcsid) {
            msgData.easyrtcsid = easyrtcsid;
        }
        if (easyrtc.credential) {
            msgData.credential = easyrtc.credential;
        }

        easyrtc.webSocket.json.emit("easyrtcAuth",
                {msgType: "authenticate",
                    msgData: msgData
                },
        function(msg) {
            var room;
            if (msg.msgType === "error") {
                errorCallback(msg.msgData.errorCode, msg.msgData.errorText);
                easyrtc.roomJoin = {};
            }
            else {
                processToken(msg);
                if (easyrtc._roomApiFields) {
                    for (room in easyrtc._roomApiFields) {
                        easyrtc._enqueueSendRoomApi(room, easyrtc._roomApiFields[room]);
                    }
                }

                if (successCallback) {
                    successCallback(easyrtc.myEasyrtcid);
                }
            }
        }
        );
    }
};
3668


/**
 * Validates that the video ids correspond to dom objects.
 * @param {type} monitorVideoId
 * @param {type} videoIds
 * @returns {undefined}
 * @private
 */
easyrtc._validateVideoIds = function(monitorVideoId, videoIds) {
    var i;
    // verify that video ids were not typos.
    if (monitorVideoId && !document.getElementById(monitorVideoId)) {
        easyrtc.showError(easyrtc.errCodes.DEVELOPER_ERR, "The monitor video id passed to easyApp was bad, saw " + monitorVideoId);
        return false;
    }

    for (i in videoIds) {
        var name = videoIds[i];
        if (!document.getElementById(name)) {
            easyrtc.showError(easyrtc.errCodes.DEVELOPER_ERR, "The caller video id '" + name + "' passed to easyApp was bad.");
            return false;
        }
    }
    return true;
};
3742
/**
 * This is a helper function for the easyApp method. It manages the assignment of video streams
 * to video objects. It assumes
 * @param {type} monitorVideoId
 * @param {type} videoIds
 * @returns {void}
 */
easyrtc.easyAppBody = function(monitorVideoId, videoIds) {
    var numPEOPLE = videoIds.length;
    var refreshPane = 0;
    var onCall = null, onHangup = null, gotMediaCallback = null, gotConnectionCallback = null;
    if (videoIds === null) {
        videoIds = [];
    }

    function videoIsFree(obj) {
        return (obj.caller === "" || obj.caller === null || obj.caller === undefined);
    }

    if (!easyrtc._validateVideoIds(monitorVideoId, videoIds)) {
        throw "bad video element id";
    }

    if (monitorVideoId) {
        document.getElementById(monitorVideoId).muted = "muted";
    }
3770

/** Sets an event handler that gets called when a call is ended.
     * it's only purpose (so far) is to support transitions on video elements.
     x     * this function is only defined after easyrtc.easyApp is called.
     * The slot is parameter is the index into the array of video ids.
     * Note: if you call easyrtc.getConnectionCount() from inside your callback
     * it's count will reflect the number of connections before the hangup started.
     * @param {Function} cb has the signature function(easyrtcid, slot){}
     * @example
     *   easyrtc.setOnHangup( function(easyrtcid, slot){
     *      console.log("call with " + easyrtcid + "ended");
     *   });
     */
   /* easyrtc.setOnHangup = function(cb) {
        onHangup = cb;
    };
	*/
    function getIthVideo(i) {
        if (videoIds[i]) {
            return document.getElementById(videoIds[i]);
        }
        else {
            return null;
        }
    }


 /*   easyrtc.getIthCaller = function(i) {
        if (i < 0 || i > videoIds.length) {
            return null;
        }
        return getIthVideo(i).caller;
    };
    easyrtc.getSlotOfCaller = function(easyrtcid) {
        var i;
        for (i = 0; i < numPEOPLE; i++) {
            if (easyrtc.getIthCaller(i) === easyrtcid) {
                return i;
            }
        }
        return -1; // caller not connected
    };
-*/
   function hideVideo(video) {
        easyrtc.setVideoObjectSrc(video, "");
        video.style.visibility = "hidden";
    }

 /*   easyrtc.setOnStreamClosed(function(caller) {
        var i;
        for (i = 0; i < numPEOPLE; i++) {
            var video = getIthVideo(i);
            if (video.caller === caller) {
                hideVideo(video);
                video.caller = "";
                if (onHangup) {
                    onHangup(caller, i);
                }
            }
        }
    });*/
    //
    // Only accept incoming calls if we have a free video object to display
    // them in.
    //
  /*  easyrtc.setAcceptChecker(function(caller, helper) {
        var i;
        for (i = 0; i < numPEOPLE; i++) {
            var video = getIthVideo(i);
            if (videoIsFree(video)) {
                helper(true);
                return;
            }
        }
        helper(false);
    });

*/
    easyrtc.setStreamAcceptor(function(caller, stream) {
        if (easyrtc.debugPrinter) {
            easyrtc.debugPrinter("stream acceptor called");
        }
        function showVideo(video, stream) {
            easyrtc.setVideoObjectSrc(video, stream);
            if (video.style.visibility) {
                video.style.visibility = 'visible';
            }
        }

        var i, video;
        if (refreshPane && videoIsFree(refreshPane)) {
            showVideo(video, stream);
            if (onCall) {
                onCall(caller, refreshPane);
            }
            refreshPane = null;
            return;
        }
        for (i = 0; i < numPEOPLE; i++) {
            video = getIthVideo(i);
            if (video.caller === caller) {
                showVideo(video, stream);
                if (onCall) {
                    onCall(caller, i);
                }
                return;
            }
        }

        for (i = 0; i < numPEOPLE; i++) {
            video = getIthVideo(i);
            if (!video.caller || videoIsFree(video)) {
                video.caller = caller;
                if (onCall) {
                    onCall(caller, i);
                }
                showVideo(video, stream);
                return;
            }
        }
//
// no empty slots, so drop whatever caller we have in the first slot and use that one.
//
        video = getIthVideo(0);
        if (video) {
            easyrtc.hangup(video.caller);
            showVideo(video, stream);
            if (onCall) {
                onCall(caller, 0);
            }
        }
        video.caller = caller;
    });
    
	var addControls, parentDiv, closeButton;
    if (easyrtc.autoAddCloseButtons) {

        addControls = function(video) {
            parentDiv = video.parentNode;
            video.caller = "";
            closeButton = document.createElement("div");
            closeButton.className = "easyrtc_closeButton";
            closeButton.onclick = function() {
                if (video.caller) {
                    easyrtc.hangup(video.caller);
                    hideVideo(video);
                    video.caller = "";
                }
            };
            parentDiv.appendChild(closeButton);
        };

        for (i = 0; i < numPEOPLE; i++) {
            addControls(getIthVideo(i));
        }
    }

    var monitorVideo = null;
    if (easyrtc.videoEnabled && monitorVideoId !== null) {
        monitorVideo = document.getElementById(monitorVideoId);
        if (!monitorVideo) {
            console.error("Programmer error: no object called " + monitorVideoId);
            return;
        }
        monitorVideo.muted = "muted";
        monitorVideo.defaultMuted = true;
    }


};

3952


/**
 * Provides a layer on top of the easyrtc.initMediaSource and easyrtc.connect, assign the local media stream to
 * the video object identified by monitorVideoId, assign remote video streams to
 * the video objects identified by videoIds, and then call onReady. One of it's
 * side effects is to add hangup buttons to the remote video objects, buttons
 * that only appear when you hover over them with the mouse cursor. This method will also add the
 * easyrtcMirror class to the monitor video object so that it behaves like a mirror.
 *  @param {String} applicationName - name of the application.
 *  @param {String} monitorVideoId - the id of the video object used for monitoring the local stream.
 *  @param {Array} videoIds - an array of video object ids (strings)
 *  @param {Function} onReady - a callback function used on success. It is called with the easyrtcId this peer is knopwn to the server as.
 *  @param {Function} onFailure - a callbackfunction used on failure (failed to get local media or a connection of the signaling server).
 *  @example
 *     easyrtc.easyApp('multiChat', 'selfVideo', ['remote1', 'remote2', 'remote3'],
 *              function(easyrtcId){
 *                  console.log("successfully connected, I am " + easyrtcId);
 *              },
 *              function(errorCode, errorText){
 *                  console.log(errorText);
 *              );
 */
easyrtc.easyApp = function(applicationName, monitorVideoId, videoIds, onReady, onFailure) {
    gotMediaCallback = null, gotConnectionCallback = null;

    if (!easyrtc._validateVideoIds(monitorVideoId, videoIds)) {
        throw "bad video id";
    }

    easyrtc.easyAppBody(monitorVideoId, videoIds);

    easyrtc.setGotMedia = function(gotMediaCB) {
        gotMediaCallback = gotMediaCB;
    };
    /** Sets an event handler that gets called when a connection to the signaling
     * server has or has not been made. Can only be called after calling easyrtc.easyApp.
     * @param {Function} gotConnectionCB has the signature (gotConnection, errorText)
     * @example
     *    easyrtc.setGotConnection( function(gotConnection, errorText){
     *        if( gotConnection ){
     *            console.log("Successfully connected to signaling server");
     *        }
     *        else{
     *            console.log("Failed to connect to signaling server because: " + errorText);
     *        }
     *    });
     */
    easyrtc.setGotConnection = function(gotConnectionCB) {
        gotConnectionCallback = gotConnectionCB;
    };




    var nextInitializationStep;
    nextInitializationStep = function(token) {
        if (gotConnectionCallback) {
            gotConnectionCallback(true, "");
        }
        onReady(easyrtc.myEasyrtcid);
    };
    easyrtc.initMediaSource(
            function() {
                if (gotMediaCallback) {
                    gotMediaCallback(true, null);
                }
                if (monitorVideoId !== null) {
                    easyrtc.setVideoObjectSrc(document.getElementById(monitorVideoId), easyrtc.getLocalStream());
                }
                function connectError(errorCode, errorText) {
                    if (gotConnectionCallback) {
                        gotConnectionCallback(false, errorText);
                    }
                    else {
                        easyrtc.showError(easyrtc.errCodes.CONNECT_ERR, errorText);
                    }
                    if (onFailure) {
                        onFailure(easyrtc.errCodes.CONNECT_ERR, errorText);
                    }
                }
                easyrtc.connect(applicationName, nextInitializationStep, connectError);
            },
            function(errorcode, errorText) {
                if (gotMediaCallback) {
                    gotMediaCallback(false, errorText);
                }
                else {
                    easyrtc.showError(easyrtc.errCodes.MEDIA_ERR, errorText);
                }
                if (onFailure) {
                    onFailure(easyrtc.errCodes.MEDIA_ERR, errorText);
                }
            }
    );
};
/**
 *
 * @deprecated now called easyrtc.easyApp.
 */
easyrtc.initManaged = easyrtc.easyApp;
//
// the below code is a copy of the standard polyfill adapter.js
//
var getUserMedia = null;
var attachMediaStream = null;
var reattachMediaStream = null;
var webrtcDetectedBrowser = null;
var webrtcDetectedVersion = null;
if (navigator.mozGetUserMedia) {
// console.log("This appears to be Firefox");

    webrtcDetectedBrowser = "firefox";
    webrtcDetectedVersion =
            parseInt(navigator.userAgent.match(/Firefox\/([0-9]+)\./)[1]);
    // The RTCPeerConnection object.
    window.RTCPeerConnection = mozRTCPeerConnection;
    // The RTCSessionDescription object.
    window.RTCSessionDescription = mozRTCSessionDescription;
    // The RTCIceCandidate object.
    window.RTCIceCandidate = mozRTCIceCandidate;
    // Get UserMedia (only difference is the prefix).
    // Code from Adam Barth.
    window.getUserMedia = navigator.mozGetUserMedia.bind(navigator);
    // Creates iceServer from the url for FF.
    window.createIceServer = function(url, username, password) {
        var iceServer = null;
        var url_parts = url.split(':');
        var turn_url_parts;
        if (url_parts[0].indexOf('stun') === 0) {
// Create iceServer with stun url.
            iceServer = {'url': url};
        } else if (url_parts[0].indexOf('turn') === 0 &&
                (url.indexOf('transport=udp') !== -1 ||
                        url.indexOf('?transport') === -1)) {
// Create iceServer with turn url.
// Ignore the transport parameter from TURN url.
            turn_url_parts = url.split("?");
            iceServer = {'url': turn_url_parts[0],
                'credential': password,
                'username': username};
        }
        return iceServer;
    };
    // Attach a media stream to an element.
    attachMediaStream = function(element, stream) {
//        console.log("Attaching media stream");
        element.mozSrcObject = stream;
        element.play();
    };
    reattachMediaStream = function(to, from) {
//        console.log("Reattaching media stream");
        to.mozSrcObject = from.mozSrcObject;
        to.play();
    };
    if (webrtcDetectedVersion < 23) {
// Fake get{Video,Audio}Tracks
        MediaStream.prototype.getVideoTracks = function() {
            return [];
        };
        MediaStream.prototype.getAudioTracks = function() {
            return [];
        };
    }
} else if (navigator.webkitGetUserMedia) {
//    console.log("This appears to be Chrome");

    webrtcDetectedBrowser = "chrome";
    webrtcDetectedVersion =
            parseInt(navigator.userAgent.match(/Chrom(e|ium)\/([0-9]+)\./)[2]);
    // Creates iceServer from the url for Chrome.
    window.createIceServer = function(url, username, password) {
        var iceServer = null;
        var url_turn_parts;
        var url_parts = url.split(':');
        if (url_parts[0].indexOf('stun') === 0) {
// Create iceServer with stun url.
            iceServer = {'url': url};
        } else if (url_parts[0].indexOf('turn') === 0) {
            if (webrtcDetectedVersion < 28) {
// For pre-M28 chrome versions use old TURN format.
                url_turn_parts = url.split("turn:");
                iceServer = {'url': 'turn:' + username + '@' + url_turn_parts[1],
                    'credential': password};
            } else {
// For Chrome M28 & above use new TURN format.
                iceServer = {'url': url,
                    'credential': password,
                    'username': username};
            }
        }
        return iceServer;
    };
    // The RTCPeerConnection object.
    window.RTCPeerConnection = webkitRTCPeerConnection;
    // Get UserMedia (only difference is the prefix).
    // Code from Adam Barth.
    window.getUserMedia = navigator.webkitGetUserMedia.bind(navigator);
    // Attach a media stream to an element.
    attachMediaStream = function(element, stream) {
        if (typeof element.srcObject !== 'undefined') {
            element.srcObject = stream;
        } else if (typeof element.mozSrcObject !== 'undefined') {
            element.mozSrcObject = stream;
        } else if (typeof element.src !== 'undefined') {
            element.src = URL.createObjectURL(stream);
        } else {
            console.log('Error attaching stream to element.');
        }
    };
    reattachMediaStream = function(to, from) {
        to.src = from.src;
    };
    // The representation of tracks in a stream is changed in M26.
    // Unify them for earlier Chrome versions in the coexisting period.
    if (!webkitMediaStream.prototype.getVideoTracks) {
        webkitMediaStream.prototype.getVideoTracks = function() {
            return this.videoTracks;
        };
        webkitMediaStream.prototype.getAudioTracks = function() {
            return this.audioTracks;
        };
    }

// New syntax of getXXXStreams method in M26.
    if (!webkitRTCPeerConnection.prototype.getLocalStreams) {
        webkitRTCPeerConnection.prototype.getLocalStreams = function() {
            return this.localStreams;
        };
        webkitRTCPeerConnection.prototype.getRemoteStreams = function() {
            return this.remoteStreams;
        };
    }
} else {
    console.log("Browser does not appear to be WebRTC-capable");
}


/** @private */
easyrtc.isMozilla = (webrtcDetectedBrowser === "firefox");

easyrtc.constantStrings = {
  "unableToEnterRoom":"Unable to enter room {0} because {1}" ,
  "resolutionWarning": "Requested video size of {0}x{1} but got size of {2}x{3}",
  "badUserName": "Illegal username {0}",
  "localMediaError": "Error getting local media stream: {0}",
  "miscSignalError": "Miscellaneous error from signalling server. It may be ignorable.",
  "noServer": "Unable to reach the EasyRTC signalling server.",
  "badsocket": "Socket.io connect event fired with bad websocket.",
  "icf": "Internal communications failure"
};



namefield
220