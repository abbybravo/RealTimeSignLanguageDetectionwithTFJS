import React, { useRef, useEffect, useState } from "react";
import Webcam from "react-webcam";
import "./App.css";
import { Hands } from "@mediapipe/hands";
import { FaceMesh } from "@mediapipe/face_mesh";

function App() {
  const webcamRef = useRef(null);
  const canvasRef = useRef(null);
  const handMemeRef = useRef(null);
  const faceMemeRef = useRef(null);
  const lastGesture = useRef(null);

  const [handMeme, setHandMeme] = useState(null);
  const [faceMeme, setFaceMeme] = useState(null); 
  const [faceBox, setFaceBox] = useState(null);  
  const memeImagesRef = useRef({});

  const activeMeme = handMeme || faceMeme;

  useEffect(() => { handMemeRef.current = handMeme; }, [handMeme]);
  useEffect(() => { faceMemeRef.current = faceMeme; }, [faceMeme]);


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
    load("huh", "/memes/huh.png");
    load("biggesteater", "/memes/biggesteater.png");
    load("thinking", "/memes/thinking.png");

    memeImagesRef.current = imgs;
    console.log("MEMES LOADED:", memeImagesRef.current);

  }, []);

  
  useEffect(() => {
    if (!webcamRef.current) return;

    const hands = new Hands({
      locateFile: (file) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
    });

    hands.setOptions({
      maxNumHands: 2,
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
      console.log("HAND RESULTS:", results);

      if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
        if (handMemeRef.current) {
          setHandMeme(null);
        }
        return;
    }
      console.log("HAND DETECTED");

      const lm = results.multiHandLandmarks[0];

      const thumbTip = lm[4];
      const indexTip = lm[8];
      const middleTip = lm[12];
      const ringTip = lm[16];
      const pinkyTip = lm[20];

      

      const isThumbsUp =
        thumbTip.y < indexTip.y &&
        thumbTip.y < middleTip.y &&
        ringTip.y > indexTip.y &&
        pinkyTip.y > indexTip.y;


      const isPeace =
        indexTip.y < ringTip.y &&
        middleTip.y < ringTip.y &&
        ringTip.y > indexTip.y &&
        pinkyTip.y > indexTip.y;

  
      if (isThumbsUp) {
        setHandMeme("thumb");
      } else if (isPeace) {
        setHandMeme("peace");
      } else {
        if (handMemeRef.current === "thumb" || handMemeRef.current === "peace") {
          setHandMeme(null);
        }
      }

    if (results.multiHandLandmarks.length === 2) {
      const hand1 = results.multiHandLandmarks[0][9];
      const hand2 = results.multiHandLandmarks[1][9];

      const dist = Math.hypot(hand1.x - hand2.x, hand1.y - hand2.y);

      if (dist < 0.18) {
        setHandMeme("thinking");
      } else if (handMemeRef.current === "thinking") {
        setHandMeme(null);
      }
    }
    };

    const onFaceResults = (results) => {
      console.log("FACE RESULTS:", results);

      if (!results.multiFaceLandmarks || results.multiFaceLandmarks.length === 0)
        return;
      console.log("FACE DETECTED");

      const face = results.multiFaceLandmarks[0];


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


      const leftMouth = face[61];
      const rightMouth = face[291];
      const mouthWidth = Math.abs(rightMouth.x - leftMouth.x);

      const brow = (face[70].y + face[63].y) / 2;
      const eye = face[159]?.y ?? 0;
      const eyeBrowRaise = brow - eye;
      

      const tongue = face[13];
      const mouthCenter = face[14];
      const mouthOpen = Math.abs(mouthCenter.y - tongue.y);

      console.log("mouthWidth:", mouthWidth);
      console.log("eyeBrowRaise:", eyeBrowRaise);
      console.log("mouthOpen:", Math.abs(mouthCenter.y - tongue.y));
      
      const newMeme =
        mouthOpen > 0.04
          ? "biggesteater"
          : eyeBrowRaise < -0.035
          ? "huh"
          : mouthWidth > 0.085
          ? "smile"
          : null;

      if (newMeme !== faceMemeRef.current) {
        setFaceMeme(newMeme);
      }
  };

    hands.onResults(onHandsResults);
    faceMesh.onResults(onFaceResults);

    let detectId;

    const detectLoop = async () => {
      console.log("DETECT LOOP RUNNING");

      const video = webcamRef.current?.video;
      console.log("VIDEO READY?", video?.readyState);

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

      // maybe change later
      canvas.width = vw;
      canvas.height = vh;

      ctx.clearRect(0, 0, vw, vh);

      ctx.lineWidth = 30;
      ctx.strokeStyle = "#f0b5f0";
      ctx.strokeRect(0, 0, vw, vh);


      ctx.fillStyle = "#FFFFFF";
      ctx.font = "bold 36px Times New Roman";
      ctx.textAlign = "center";
      ctx.fillText("Meme Detector", vw / 2, 50);

      ctx.font = "20px Times New Roman";
      ctx.fillText("Make an expression and watch a meme pop up!", vw / 2, 90);

      if (activeMeme && faceBox && memeImagesRef.current[activeMeme]) {
        const img = memeImagesRef.current[activeMeme];

        const faceCenterX =
          ((faceBox.xMin + faceBox.xMax) / 2) * vw;
        const faceCenterY =
          ((faceBox.yMin + faceBox.yMax) / 2) * vh;

        const leftSpace = faceCenterX;
        const rightSpace = vw - faceCenterX;

        //should it pop up bigger or smaller?
        const memeWidth = vw * 0.40;
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
  }, [activeMeme, faceBox]);

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
