// ==========================================
// 1. ตั้งค่า API Key และ Config
// ==========================================
const GEMINI_API_KEY = "AQ.Ab8RN6IR2KYm1NDZ4DMSyd4ahCntd8Vi3120JD5kwhiYQXcaaw";
const SUPABASE_URL = "https://nuuntbfzvgyyldjqegks.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im51dW50YmZ6dmd5eWxkanFlZ2tzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEzNTIxNTAsImV4cCI6MjEwNjkyODE1MH0.Txia0Zzu48kWAQcPIejGo3R9LmJW4KomTybaWrBjiCA";

// Initialize Supabase Client
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ==========================================
// 2. ฟังก์ชันจัดการรูปภาพ (Preview & Remove)
// ==========================================
function previewImage(event) {
  const file = event.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = function(e) {
      document.getElementById('imagePreview').src = e.target.result;
      document.getElementById('uploadBox').classList.add('hidden');
      document.getElementById('previewContainer').classList.remove('hidden');
    }
    reader.readAsDataURL(file);
  }
}

function removeImage() {
  document.getElementById('imageInput').value = '';
  document.getElementById('uploadBox').classList.remove('hidden');
  document.getElementById('previewContainer').classList.add('hidden');
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = error => reject(error);
  });
}

// ==========================================
// 3. ฟังก์ชันประมวลผลรูปภาพร่วมกับรายวิชา
// ==========================================
async function processImage() {
  const fileInput = document.getElementById('imageInput');
  const file = fileInput.files[0];
  const selectedSubject = document.getElementById('subjectSelect').value;

  if (!file) {
    alert("กรุณากดปุ่มเลือกรูปภาพสไลด์เรียนก่อนครับ");
    return;
  }

  const submitBtn = document.getElementById('submitBtn');
  const loadingState = document.getElementById('loadingState');
  const resultCard = document.getElementById('resultCard');

  submitBtn.disabled = true;
  submitBtn.classList.add('opacity-50', 'cursor-not-allowed');
  loadingState.classList.remove('hidden');
  resultCard.classList.add('hidden');

  try {
    const base64Image = await fileToBase64(file);

    // Prompt ปรับแต่งตามรายวิชาที่เลือก
    const promptText = `คุณคือเพื่อนนักศึกษาสุดชิลที่สรุปชีทเรียนเก่งมาก หน้าที่ของคุณคืออ่านสไลด์หรือรูปภาพชีทเรียนในรายวิชา "${selectedSubject}" แล้วย่อความให้ออกมาเป็นภาษาพูดของเด็กมหาลัยที่เข้าใจง่าย
    
โปรดตอบกลับในรูปแบบ JSON Object เท่านั้น (ห้ามใส่สัญลักษณ์ Markdown ตัวอย่างเช่น \`\`\`json ใดๆ ทั้งสิ้น) โดยใช้โครงสร้างดังนี้:
{
  "summary": "สรุปใจความสำคัญในรูปภาพ 3 บรรทัด สั้น กระชับ ใช้ภาษาเพื่อนเด็กมหาลัยคุยกัน",
  "analogy": "การเปรียบเทียบเนื้อหาในรายวิชานี้กับเรื่องในชีวิตประจำวันของเด็กมหาลัย 1 เรื่องเพื่อให้เข้าใจง่ายขึ้น",
  "vocab": "คำศัพท์วิชาการ/ภาษาอังกฤษสำคัญในภาพ 2-3 คำ พร้อมคำแปลภาษาไทยเข้าใจง่าย"
}`;

    // ส่ง Request ไปยัง Gemini 1.5 Flash Vision API
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: promptText },
            { inline_data: { mime_type: file.type, data: base64Image } }
          ]
        }]
      })
    });

    const data = await response.json();
    
    if (!data.candidates || !data.candidates[0]) {
      throw new Error("ไม่สามารถประมวลผลภาพได้ กรุณาตรวจสอบ API Key");
    }

    let rawText = data.candidates[0].content.parts[0].text;
    rawText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsedResult = JSON.parse(rawText);

    // แสดงผลวิชาและเนื้อหาบนการ์ด
    document.getElementById('resultSubjectTag').innerText = `หมวดวิชา: ${selectedSubject}`;
    document.getElementById('summaryText').innerText = parsedResult.summary;
    document.getElementById('analogyText').innerText = parsedResult.analogy;
    document.getElementById('vocabText').innerText = parsedResult.vocab;

    // บันทึกลง Supabase Database (แนบหมวดวิชาไปด้วย)
    await supabase.from('summaries').insert([
      { 
        summary_result: {
          subject: selectedSubject,
          ...parsedResult
        } 
      }
    ]);

    resultCard.classList.remove('hidden');

  } catch (error) {
    console.error(error);
    alert("เกิดข้อผิดพลาดในการประมวลผล ลองใหม่อีกครั้ง หรือตรวจสอบคีย์ API ครับ");
  } finally {
    submitBtn.disabled = false;
    submitBtn.classList.remove('opacity-50', 'cursor-not-allowed');
    loadingState.classList.add('hidden');
  }
}
