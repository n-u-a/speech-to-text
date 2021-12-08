/**
 * 諸々必要な変数
 */
var flag_speech = 0;
var flag_now_recording = false;
var recognition;
var flag_push_enable = 0;
const COOKIE_KEYS = ['webhook', 'name', 'image', 'channel']
const LANG_KEY = 'lang'

/**
 * slackにメッセージ送信
 * @param {*} text 
 */
function call_slack(text) {
    var url = $('#webhook').val();
    var name = $('#name').val();
    var url_image = $('#image').val();
    var format = new DateFormat("HH:mm");
    var str_time = format.format(new Date());
    var channel = $('#channel').val();
    var msg = `[${str_time}]${text}`;
    recorder &&
        recorder.exportWAV((blob) => {
            let formData = new FormData()
            formData.append('data', blob)
            $.ajax({
                data: 'payload=' + JSON.stringify({
                    text: msg,
                    username: name,
                    icon_url: url_image,
                    channel: channel,
                    voice: formData
                }),
                type: 'POST',
                url: url,
                dataType: 'json',
                processData: false,
                success: function () {
                    console.log('OK');
                }
            }).done((data) => {
                recorder.clear()
            });
        })
}

/**
 * 録音+文字起こし処理
 */
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

/**
 * 録音+文字起こしの待ち受け状態切替
 */
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

/**
 * EventListners
 */
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

/**
 * cookieに保管されている値を取得
 * @returns cookies
 */
function get_cookies() {
    var result = [];
    var cookies = document.cookie.split(";");
    for (var cookie of cookies) {
        var kv = cookie.trim().split("=");
        result[kv[0]] = decodeURIComponent(kv[1])
    }
    return result;
}

/**
 * cookieに設定情報を保存
 * @param {*} data 
 */
function save_cookies(data) {
    for (var k in data) {
        document.cookie = k + "=" + encodeURIComponent(data[k]) + ";";
    }
}

/**
 * cookieから設定情報を復元
 */
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

/**
 * cookieに保存する設定情報を取得し、save_cookiesを利用
 */
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

/**
 * wav作成に利用する変数宣言
 */
var audio_context;
var recorder;

function __log(e, data) {
    log.innerHTML += "\n" + e + " " + (data || '');
}

/**
 * 録音を開始
 */
function startRecording() {
    recorder && recorder.record();
    // button.disabled = true;
    // button.nextElementSibling.disabled = false;
    __log('Recording...');
}

/**
 * 録音を停止
 */
function stopRecording() {
    recorder && recorder.stop();
    // button.disabled = true;
    // button.previousElementSibling.disabled = false;
    __log('Stopped recording.');

    // create WAV download link using audio data blob
    createDownloadLink();

    recorder.clear();
}

/**
 * マイクを利用するために使用？
 * このメソッド以下が不要の可能性あり
 * @param {*} stream 
 */
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

// wavの作成開始のために必要
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