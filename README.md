# Stem Flow

Browser-based four-stem mixer prototype using MediaPipe Hands for local webcam hand tracking.

## Run it

Open `index.html` in a modern desktop browser. For a local server (recommended for camera permission), run this command from the project directory:

```sh
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

Tap the camera page once, grant camera access, and hold both palms together for half a second. The page then shows **OPEN YOUR HANDS TO PLAY MUSIC**. When both palms open, the four transparent stem circles appear in the corners and the demo starts. Left-hand height controls vocal/bass; right-hand height controls drums/others. Two closed fists pause playback. The demo is `lifesaver Mix V4.wav`, separated locally with Demucs into four 320 kbps MP3 stems in `assets/demo/`.

## MediaPipe dependency

The app loads the browser version of [MediaPipe Hands](https://chuoling.github.io/mediapipe/solutions/hands.html) from jsDelivr, including its model assets. It therefore requires an internet connection the first time it runs. Hand video is processed in the browser and is not uploaded by this app.
