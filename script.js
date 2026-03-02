import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, getDocs, addDoc, query, where, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig={
  apiKey:"AIzaSyCTfQQHRjOf361iehJWd6Ao4on8yReT1l4",
  authDomain:"scimasterquiz.firebaseapp.com",
  projectId:"scimasterquiz"
};
const app=initializeApp(firebaseConfig);
const db=getFirestore(app);

const schoolInput=document.getElementById("school");
const nameInput=document.getElementById("name");
const startBox=document.getElementById("startBox");
const quizBox=document.getElementById("quizBox");
const resultBox=document.getElementById("resultBox");
const countdownOverlay=document.getElementById("countdownOverlay");
const countdownBox=document.getElementById("countdownBox");
const customAlert=document.getElementById("customAlert");
const alertMessage=document.getElementById("alertMessage");

function showAlert(msg){alertMessage.innerText=msg;customAlert.classList.add("active");setTimeout(()=>customAlert.classList.remove("active"),2500);}
function getDeviceId(){let id=localStorage.getItem("deviceId");if(!id){id='dev_'+Math.random().toString(36).substr(2,16);localStorage.setItem("deviceId",id);}return id;}
let questions=[],current=0,score=0,timer,timeLeft=60,currentDeviceId;



// ------------------ Sunday + Time Restriction with Typing Effect ------------------
function checkQuizAvailability() {
  const now = new Date();
  const day = now.getDay(); // Sunday = 0
  const hour = now.getHours();

  function showTypingPopup(message){
    alertMessage.innerHTML = "";              // clear old text
    customAlert.style.opacity = "0";
    customAlert.classList.add("active");

    // Fade-in
    setTimeout(() => { customAlert.style.transition = "opacity 0.5s"; customAlert.style.opacity = "1"; }, 50);

    // Typing effect with emoji + line breaks
    let idx = 0;
    const typingSpeed = 50; // milliseconds per character
    const typeInterval = setInterval(() => {
      if(idx < message.length){
        alertMessage.innerHTML += message.charAt(idx) === "\n" ? "<br>" : message.charAt(idx);
        idx++;
      } else {
        clearInterval(typeInterval);
      }
    }, typingSpeed);

    // Fade-out after 4s
    setTimeout(() => { customAlert.style.opacity = "0"; }, 10000);
    setTimeout(() => { customAlert.classList.remove("active"); }, 10000);
  }

  // ------------------ Sunday check ------------------
  if(day !== 1){ // Not Sunday
    startBox.style.display = "none";
    quizBox.style.display = "none";
    showTypingPopup("🚫 Quiz Available Only on Sunday!\nPlease Come Back Next Sunday 🔥");
    return false;
  }

  // ------------------ Time restriction ------------------
  if(hour < 6){
    startBox.style.display = "none";
    quizBox.style.display = "none";
    showTypingPopup("🌅 Good Morning!\nQuiz Opens At 6:00 AM\nPlease Come Back Soon 🔥");
    return false;
  }

  if(hour >= 18){
    startBox.style.display = "none";
    quizBox.style.display = "none";
    showTypingPopup("🌙 Quiz Time Over!\nQuiz Available From 6:00 AM - 6:00 PM\nSee You Next Day 🔥");
    return false;
  }

  customAlert.classList.remove("active");
  return true;
}

async function loadQuestionsFromJSON() {
  try {
    const response = await fetch("questions.json");
    questions = await response.json();
    questions.sort(() => Math.random() - 0.5);
  } catch (error) {
    console.error("Error loading questions:", error);
    showAlert("Failed to load questions!");
  }
}

// Shuffle questions
questions.sort(() => Math.random() - 0.5);

// ------------------ Device check ------------------
async function hasPlayedDevice(deviceId){
  const q=query(collection(db,"participants"),where("deviceId","==",deviceId));
  const snap=await getDocs(q);
  return !snap.empty;
}

// ------------------ Prepare Quiz with daily limit ------------------
window.prepareQuiz = async function() {

if(!checkQuizAvailability()) return;

 await loadQuestionsFromJSON();

  const school = schoolInput.value.trim();
  const name = nameInput.value.trim();
  if (!school || !name) { showAlert("කරුණාකර සියලු fields පුරවන්න"); return; }

  currentDeviceId = getDeviceId();
  if (await hasPlayedDevice(currentDeviceId)) { showAlert("❌ Submission Blocked: ඔබ quiz එක දැනටමත් ක්‍රීඩා කර ඇත!"); return; }

  const snap = await getDocs(collection(db,"participants"));
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const todayEnd = todayStart + 24*60*60*1000;
  let todayCount = 0;
  snap.forEach(doc => { const t = doc.data().timestamp?.toMillis(); if(t>=todayStart && t<todayEnd) todayCount++; });

  if(todayCount>=5000){ showAlert("❌ Our database has exceeded the daily Users limit of 5000+!, Try Again Next Day."); return; }

  // Countdown
  let numbers=[3,2,1], idx=0;
  countdownOverlay.classList.add("active");
  countdownBox.innerText=`Quiz is Ready! ${numbers[idx]}`;
  const interval=setInterval(()=>{
    idx++;
    if(idx<numbers.length){ countdownBox.innerText=`Quiz is Ready! ${numbers[idx]}`; }
    else{ clearInterval(interval); countdownOverlay.classList.remove("active"); startQuiz(); }
  },1000);
}

// ------------------ Start Quiz ------------------
window.startQuiz = function(){
  startBox.style.display="none"; quizBox.style.display="block"; current=0; score=0; loadQuestion();
}

function loadQuestion(){
  if(current>=questions.length){ finish(); return; }
  const q=questions[current];
  let html=`<h3>${current+1}. ${q.q}</h3>`;
  q.options.forEach((o,i)=>{ html+=`<div class="option" onclick="selectAns(${i})">${o}</div>`; });
  html += `<div id="progressContainer"><div id="progressBar"></div></div>`;
  quizBox.innerHTML=html; quizBox.classList.add("slide-in");
  setTimeout(()=>quizBox.classList.remove("slide-in"),1000);

  timeLeft=60;
  const progressBar=document.getElementById("progressBar"); progressBar.style.width="100%"; progressBar.style.background="var(--accent)";
  clearInterval(timer);
  timer=setInterval(()=>{
    timeLeft--;
    progressBar.style.width=(timeLeft/60*100)+"%";
    if(timeLeft<=0){ clearInterval(timer); selectAns(-1); }
  },1000);
}

window.selectAns=function(i){
  clearInterval(timer);
  const options=document.querySelectorAll(".option");
  const correct=questions[current].answer;
  const progressBar=document.getElementById("progressBar");

  options.forEach((el,idx)=>{
    el.style.pointerEvents="none";
    if(idx===correct){ el.style.background="green"; el.style.color="white"; progressBar.style.background="green"; if(i===correct) confetti({particleCount:30,spread:60,origin:{y:0.6}});}
    if(idx===i && i!==correct){ el.style.background="red"; el.style.color="white"; el.innerText="❌ "+el.innerText; progressBar.style.background="red";}
  });

  if(i===correct) score++;
  setTimeout(()=>{ current++; loadQuestion(); },1700);
}

// ---------------- Submit Quiz to Firestore ----------------
async function finish(){
  quizBox.style.display="none"; resultBox.style.display="block";
  const now=new Date();
  const month=now.getMonth()+1;

  await addDoc(collection(db,"participants"),{
    key: nameInput.value+" : "+schoolInput.value,
    score,
    timestamp: serverTimestamp(),
    deviceId: currentDeviceId,
    month: month
  });

  if(score>=questions.length*0.75) confetti({particleCount:150,spread:70,origin:{y:0.6}});

  resultBox.innerHTML=`<h2>Your Score: ${score}</h2><h3 id="returnTimer" style="margin-top:15px;color:red;">Returning to Home in 6s</h3>`;
  updatePlayedCount();

  let waitTime=6; const returnTimer=document.getElementById("returnTimer");
  const countdown=setInterval(()=>{
    waitTime--; if(waitTime>0) returnTimer.innerText=`Returning to Home in ${waitTime}s`; else{ clearInterval(countdown); location.reload(); }
  },1000);
}

async function updatePlayedCount(){
  const playedNumber=document.getElementById("playedNumber");
  const snap=await getDocs(collection(db,"participants"));
  const now=new Date();
  const todayStart=new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const todayEnd = todayStart + 24*60*60*1000;
  let count=0;
  snap.forEach(doc=>{ const t=doc.data().timestamp?.toMillis(); if(t>=todayStart && t<todayEnd) count++; });
  playedNumber.innerText=count;
}
updatePlayedCount();
checkQuizAvailability();

window.toggleMode=function(){document.body.classList.toggle("dark"); const icon=document.getElementById("modeIcon"); if(document.body.classList.contains("dark")) icon.classList.replace("fa-sun","fa-moon"); else icon.classList.replace("fa-moon","fa-sun");}
document.addEventListener('contextmenu',e=>{e.preventDefault();showAlert("Right Click Blocked!");});
document.addEventListener('copy',e=>{e.preventDefault();showAlert("Copy Blocked!");});
document.addEventListener('cut',e=>{e.preventDefault();showAlert("Cut Blocked!");});
document.addEventListener('paste',e=>{e.preventDefault();showAlert("Paste Blocked!");});

