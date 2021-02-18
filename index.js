const WebSocket = require("ws");
const express = require("express");
const app = express();
const server = require("http").createServer(app);
const wss = new WebSocket.Server({ server });

//Include Google Speech to Text
const speech = require("@google-cloud/speech");
const speech_client = new speech.SpeechClient();

const accountSid = 'your_account_sid'
const authToken = 'your_auth_token'
const twilio_client = require('twilio')(accountSid, authToken);
var global_sid = null;

//Configure Transcription Request
const request = {
  config: {
    encoding: "MULAW",
    sampleRateHertz: 8000,
    languageCode: "en-US"
  },
  interimResults: true
};

// Handle Web Socket Connection
wss.on("connection", function connection(ws) {

  console.log("New Connection Initiated");

  let recognizeStream = null;

   ws.on("message", function incoming(message) {

    const msg = JSON.parse(message);

    //console.log(`msg.event: ${msg.event}`);

    switch (msg.event) {
      case "connected":
        console.log(`A new call has connected.`);

        // Create Stream to the Google Speech to Text API
        recognizeStream = speech_client
          .streamingRecognize(request)
          .on("error", console.error)
          .on("data", data => {
            console.log(data.results[0].alternatives[0].transcript);

        console.log('Sending Digits');
        twilio_client.calls(global_sid)
              .update({twiml: '<Response><Play digits="ww1ww2ww3ww4ww5ww6ww7ww8ww9"></Play></Response>'})
              .then(call => console.log(call.to));
                  });
        break;

        break;
      case "start":
        console.log(`Starting Media Stream ${msg.streamSid}`);
        break;
      case "media":
        //console.log(`Receiving Audio...`);
        // Write Media Packets to the recognize stream
        recognizeStream.write(msg.media.payload);
        break;
      case "stop":
        console.log(`Call Has Ended`);
        recognizeStream.destroy();
        break;
    }
  });

});

app.get("/", (req, res) => res.send("Hello World"));

app.post("/", (req, res) => {
  res.set("Content-Type", "text/xml");

  res.send(`
    <Response>
      <Start>
        <Stream url="wss://${req.headers.host}/"/>
      </Start>
      <Say>I will stream the next 60 seconds of audio through your websocket</Say>
      <Pause length="60" />
    </Response>
  `);
});

app.post("/call_outbound.xml", (req, res) => {

  console.log('In call-outbound...');

  res.set("Content-Type", "text/xml");

  res.send(`
    <Response>
        <Start>
          <Stream url="wss://${req.headers.host}/"/>
        </Start>
        <Pause length="10" />
        <Say voice="alice">We are looking for good quality donkeys. Do you have any? Answer and wait for my next prompt.</Say>
        <Pause length="5" />
        <Say voice="alice">OK, I think I understand. Do you have any digits for me?</Say>
        <Pause length="1" />
        <Say voice="alice">That's all for now. You must live long and prosper. Hang loose!</Say>
    </Response>`
  );

});

app.get("/test-outbound", (req, res) => {


  twilio_client.calls
        .create({
           url: 'http://0a7e2eae9924.ngrok.io/call_outbound.xml',
           to: '+16149156030',
           from: '+15035491316'
         })
        .then(call => {
          console.log(`call.sid: ${call.sid}`);
          global_sid = call.sid;
        });

  console.log("Made an outbound call.");
})

console.log("Listening at Port 8080");
server.listen(8080);
