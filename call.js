var flag_speech = 0;
var flag_now_recording = false;
var recognition;
var flag_push_enable = 0;
const COOKIE_KEYS = ['webhook', 'name', 'image', 'channel']
const LANG_KEY = 'lang'

function call_slack(text) {
    var url = $('#webhook').val();
    var name = $('#name').val();
    var url_image = $('#image').val();
    var format = new DateFormat("HH:mm");
    var str_time = format.format(new Date());
    var channel = $('#channel').val();
    var msg = `[${str_time}]${text}`;
    $.ajax({
        data: 'payload=' + JSON.stringify({
            text: msg,
            username: name,
            icon_url: url_image,
            channel: channel
        }),
        type: 'POST',
        url: url,
        dataType: 'json',
        processData: false,
        success: function () {
            console.log('OK');
        }
    });
}

function record() {
    window.SpeechRecognition = window.SpeechRecognition || webkitSpeechRecognition;
    recognition = new webkitSpeechRecognition();
    var str_lang = $('input:radio[name="radio2"]:checked').val();
    recognition.lang = str_lang;
    recognition.interimResults = true;
    recognition.continuous = true;
    save_input_to_cookie()

    recognition.onsoundstart = () => {
        console.log("サウンドスタート")
        $("#status").val("Recording");
    };

    recognition.onnomatch = () => {
        $("#status").val("Retry");
    };

    recognition.onerror = (event) => {
        $("#status").val(event.error);
        if (flag_speech == 0) { record(); }
    };

    recognition.onsoundend = () => {
        $("#status").val("Stopped");
        console.log("onsoundendでストップ");
        recognition.stop();
        stopRecording();
        record();
    };

    recognition.onresult = (event) => {
        var results = event.results;
        for (var i = event.resultIndex; i < results.length; i++) {
            if (results[i].isFinal) {
                var text = results[i][0].transcript;
                $("#result_text").val(text);
                call_slack(text);
                recognition.stop();
                console.log("onresultでストップ");
                record();
            }
            else {
                var text = results[i][0].transcript;
                $("#result_text").val(text);
                flag_speech = 1;
            }
        }
    }

    $("#result_text").val('START');
    flag_speech = 0;
    recognition.start();
    console.log("スタートが動いています");

    $('#send').on('click', () => {
        console.log("送る");
    });
}

function get_cookies() {
    var result = [];
    var cookies = document.cookie.split(";");
    for (var cookie of cookies) {
        var kv = cookie.trim().split("=");
        result[kv[0]] = decodeURIComponent(kv[1])
    }
    return result;
}

function toggle_recording() {
    if (flag_now_recording) {
        if (recognition) {
            console.log("toggleRecordingでストップ");

            recognition.stop();
        }
        console.log("トグルオフ")
        $('#record').val('RECORD START');
        $('#record').removeClass('uk-button-danger').addClass('uk-button-primary');
        flag_now_recording = false;
        $('#send').off('click');
    }
    else {
        $('#record').val('RECORD STOP');
        $('#record').removeClass('uk-button-primary').addClass('uk-button-danger');
        flag_now_recording = true;
        startRecording();
        record();
    }
}

function save_cookies(data) {
    for (var k in data) {
        document.cookie = k + "=" + encodeURIComponent(data[k]) + ";";
    }
}

function restore_input_from_cookie() {
    var cookies = get_cookies();
    for (var key of COOKIE_KEYS) {
        $("#" + key).val(cookies[key]);
    }
    var lang = cookies[LANG_KEY]
    if (lang) {
        var radio = Object.values($(`.uk-radio[value=${lang}]`))
        if (radio.length >= 0) {
            radio[0].checked = true;
        }
    }
}

function save_input_to_cookie() {
    var data = {};
    for (var key of COOKIE_KEYS) {
        data[key] = $("#" + key).val();
    }
    var lang_radios = $(".uk-radio:checked");
    if (lang_radios.length >= 0) {
        data[LANG_KEY] = lang_radios[0].value
    }
    save_cookies(data);
}

$(function () {
    $('#record').on('click', () => {
        toggle_recording();
    });

    $(document).ready(() => {
        restore_input_from_cookie();
    });

    $('#slack-submit').on('click', () => {
        call_slack('Slack Notify');
    });
});


var audio_context;
var recorder;

function __log(e, data) {
    log.innerHTML += "\n" + e + " " + (data || '');
}

function startUserMedia(stream) {
    var input = audio_context.createMediaStreamSource(stream);
    audio_context.resume();
    __log('Media stream created.');

    // Uncomment if you want the audio to feedback directly
    //input.connect(audio_context.destination);
    //__log('Input connected to audio context destination.');

    recorder = new Recorder(input);
    __log('Recorder initialised.');
}

function startRecording() {
    recorder && recorder.record();
    // button.disabled = true;
    // button.nextElementSibling.disabled = false;
    __log('Recording...');
}

function stopRecording() {
    recorder && recorder.stop();
    // button.disabled = true;
    // button.previousElementSibling.disabled = false;
    __log('Stopped recording.');

    // create WAV download link using audio data blob
    createDownloadLink();

    recorder.clear();
}

function createDownloadLink() {
    recorder && recorder.exportWAV(function (blob) {
        var url = URL.createObjectURL(blob);
        var li = document.createElement('li');
        var au = document.createElement('audio');
        var hf = document.createElement('a');

        au.controls = true;
        au.src = url;
        hf.href = url;
        hf.download = new Date().toISOString() + '.wav';
        hf.innerHTML = hf.download;
        li.appendChild(au);
        li.appendChild(hf);
        recordingslist.appendChild(li);
    });
}

window.onload = function init() {
    try {
        // webkit shim
        window.AudioContext = window.AudioContext || window.webkitAudioContext;
        if (navigator.mediaDevices === undefined) {
            navigator.mediaDevices = {};
        }
        if (navigator.mediaDevices.getUserMedia === undefined) {
            navigator.mediaDevices.getUserMedia = function (constraints) {
                // First get ahold of the legacy getUserMedia, if present
                let getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia;

                // Some browsers just don't implement it - return a rejected promise with an error
                // to keep a consistent interface
                if (!getUserMedia) {
                    return Promise.reject(new Error('getUserMedia is not implemented in this browser'));
                }

                // Otherwise, wrap the call to the old navigator.getUserMedia with a Promise
                return new Promise(function (resolve, reject) {
                    getUserMedia.call(navigator, constraints, resolve, reject);
                });
            }
        }
        window.URL = window.URL || window.webkitURL;

        audio_context = new AudioContext;
        __log('Audio context set up.');
        __log('navigator.mediaDevices ' + (navigator.mediaDevices.length != 0 ? 'available.' : 'not present!'));
    } catch (e) {
        alert('No web audio support in this browser!');
    }

    navigator.mediaDevices.getUserMedia({ audio: true })
        .then(function (stream) {
            startUserMedia(stream);
        })
        .catch(function (e) {
            __log('No live audio input: ' + e);
        });
};