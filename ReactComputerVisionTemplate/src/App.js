// App.js

import React, { useRef, useEffect, useState } from "react";
import Webcam from "react-webcam";
import "./App.css";
import { Hands } from "@mediapipe/hands";
import { FaceMesh } from "@mediapipe/face_mesh";

function App() {
  const webcamRef = useRef(null);
  const canvasRef = useRef(null);

  const [meme, setMeme] = useState(null);        // "thumb" | "peace" | "smile" | null
  const [faceBox, setFaceBox] = useState(null);  // { xMin, xMax, yMin, yMax } in normalized coords
  const memeImagesRef = useRef({});

  // Preload meme images
  useEffect(() => {
    const imgs = {};
    const load = (key, src) => {
      const img = new Image();
      img.src = src;
      imgs[key] = img;
    };

    load("thumb", "/memes/thumb.png");
    load("peace", "/memes/peace.png");
    load("smile", "/memes/smile.png");

    memeImagesRef.current = imgs;
  }, []);

  // Gesture + face detection setup
  useEffect(() => {
    if (!webcamRef.current) return;

    const hands = new Hands({
      locateFile: (file) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
    });

    hands.setOptions({
      maxNumHands: 1,
      modelComplexity: 1,
      minDetectionConfidence: 0.7,
      minTrackingConfidence: 0.7,
    });

    const faceMesh = new FaceMesh({
      locateFile: (file) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
    });

    faceMesh.setOptions({
      maxNumFaces: 1,
      refineLandmarks: true,
      minDetectionConfidence: 0.7,
      minTrackingConfidence: 0.7,
    });

    const onHandsResults = (results) => {
      if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0)
        return;

      const lm = results.multiHandLandmarks[0];

      const thumbTip = lm[4];
      const indexTip = lm[8];
      const middleTip = lm[12];
      const ringTip = lm[16];
      const pinkyTip = lm[20];

      // Very rough heuristics:

      // 👍 thumbs up: thumb above index & middle, others lower
      const isThumbsUp =
        thumbTip.y < indexTip.y &&
        thumbTip.y < middleTip.y &&
        ringTip.y > indexTip.y &&
        pinkyTip.y > indexTip.y;

      // ✌️ peace: index & middle high, ring & pinky low
      const isPeace =
        indexTip.y < ringTip.y &&
        middleTip.y < ringTip.y &&
        ringTip.y > indexTip.y &&
        pinkyTip.y > indexTip.y;

      if (isThumbsUp) setMeme("thumb");
      else if (isPeace) setMeme("peace");
    };

    const onFaceResults = (results) => {
      if (!results.multiFaceLandmarks || results.multiFaceLandmarks.length === 0)
        return;

      const face = results.multiFaceLandmarks[0];

      // Compute face bounding box in normalized coords
      let xMin = 1,
        xMax = 0,
        yMin = 1,
        yMax = 0;
      face.forEach((p) => {
        if (p.x < xMin) xMin = p.x;
        if (p.x > xMax) xMax = p.x;
        if (p.y < yMin) yMin = p.y;
        if (p.y > yMax) yMax = p.y;
      });
      setFaceBox({ xMin, xMax, yMin, yMax });

      // Smile detection: distance between mouth corners
      const leftMouth = face[61];
      const rightMouth = face[291];
      const mouthWidth = Math.abs(rightMouth.x - leftMouth.x);

      if (mouthWidth > 0.07) {
        setMeme("smile");
      }
    };

    hands.onResults(onHandsResults);
    faceMesh.onResults(onFaceResults);

    let detectId;
    const detectLoop = async () => {
      const video = webcamRef.current?.video;
      if (video && video.readyState === 4) {
        await hands.send({ image: video });
        await faceMesh.send({ image: video });
      }
      detectId = requestAnimationFrame(detectLoop);
    };

    detectLoop();

    return () => {
      if (detectId) cancelAnimationFrame(detectId);
      hands.close();
      faceMesh.close();
    };
  }, []);

  // Drawing loop: draw meme next to face
  useEffect(() => {
    let drawId;

    const draw = () => {
      const canvas = canvasRef.current;
      const video = webcamRef.current?.video;
      if (!canvas || !video || video.readyState !== 4) {
        drawId = requestAnimationFrame(draw);
        return;
      }

      const ctx = canvas.getContext("2d");
      const vw = video.videoWidth;
      const vh = video.videoHeight;

      // Full-screen canvas
      canvas.width = vw;
      canvas.height = vh;

      ctx.clearRect(0, 0, vw, vh);

      if (meme && faceBox && memeImagesRef.current[meme]) {
        const img = memeImagesRef.current[meme];

        const faceCenterX =
          ((faceBox.xMin + faceBox.xMax) / 2) * vw;
        const faceCenterY =
          ((faceBox.yMin + faceBox.yMax) / 2) * vh;

        const leftSpace = faceCenterX;
        const rightSpace = vw - faceCenterX;

        // Auto-scale meme to ~20% of screen width
        const memeWidth = vw * 0.2;
        const aspect =
          img.width && img.height ? img.height / img.width : 1;
        const memeHeight = memeWidth * aspect;

        let x;
        if (rightSpace >= leftSpace) {
          x = faceCenterX + memeWidth * 0.2;
        } else {
          x = faceCenterX - memeWidth * 1.2;
        }
        const y = faceCenterY - memeHeight / 2;

        ctx.drawImage(img, x, y, memeWidth, memeHeight);
      }

      drawId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      if (drawId) cancelAnimationFrame(drawId);
    };
  }, [meme, faceBox]);

  return (
    <div className="App">
      <header className="App-header">
        <Webcam
          ref={webcamRef}
          muted={true}
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: "100vw",
            height: "100vh",
            objectFit: "cover",
            zIndex: 1,
          }}
        />
        <canvas
          ref={canvasRef}
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: "100vw",
            height: "100vh",
            zIndex: 2,
          }}
        />
      </header>
    </div>
  );
}

export default App;
