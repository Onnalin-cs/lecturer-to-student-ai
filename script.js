const GEMINI_API_KEY = "AQ.Ab8RN6Jr0zmcqHmikIk_BUD7TkCfLO-FOXRuhhDCxicj-lgjiA";
const SUPABASE_URL = "https://nuuntbfzvgyyldjqegks.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im51dW50YmZ6dmd5eWxkanFlZ2tzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEzNTIxNTAsImV4cCI6MjEwNjkyODE1MH0.Txia0Zzu48kWAQcPIejGo3R9LmJW4KomTybaWrBjiCA";

// Initialize Supabase
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function previewSelectedImage(event) {
  const file = event.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = function(e) {
      document.getElementById('imagePreview').src = e.target.result;
      document.getElementById('uploadPlaceholder').classList.add('hidden');
      document.getElementById('previewContainer').classList.remove('hidden');
    }
    reader.readAsDataURL(file);
  }
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = error => reject(error);
  });
}

async function processImage() {
  const fileInput = document.getElementById('imageInput');
  const file = fileInput.files[0];

  if (!file) {
    alert("กรุณาเลือกหรือแนบรูปภาพสไลด์ก่อนครับ");
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

    const promptText = `คุณคือเพื่อนนักศึกษาสุดชิลที่สรุปชีทเรียนเก่งมาก หน้าที่ของคุณคืออ่านสไลด์หรือรูปภาพลายมือภาษาอังกฤษ/ภาษาวิชาการยากๆ แล้วย่อความให้ออกมาเป็นภาษาพูดของเด็กมหาลัย[span_11](start_span)[span_11](end_span)
    
โปรดตอบกลับในรูปแบบ JSON Object เท่านั้น (ห้ามใส่สัญลักษณ์ Markdown ตัวอย่างเช่น \`\`\`json ใดๆ ทั้งสิ้น) โดยใช้โครงสร้างดังนี้:
{
  "summary": "สรุปใจความสำคัญในรูปภาพ 3 บรรทัด สั้น กระชับ ใช้ภาษาเพื่อนเด็กมหาลัยคุยกัน[span_12](start_span)[span_12](end_span)",
  "analogy": "การเปรียบเทียบเนื้อหาวิชาการนี้กับเรื่องในชีวิตประจำวันของเด็กมหาลัย 1 เรื่องเพื่อให้เข้าใจง่ายขึ้น[span_13](start_span)[span_13](end_span)",
  "vocab": "คำศัพท์วิชาการ/ภาษาอังกฤษสำคัญ 2-3 คำ พร้อมคำแปลภาษาไทยเข้าใจง่าย"
}`;

    // ส่ง Request หา Gemini Flash API
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
    let rawText = data.candidates[0].content.parts[0].text;
    rawText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsedResult = JSON.parse(rawText);

    // แสดงผลบนหน้าเว็บ
    document.getElementById('summaryText').innerText = parsedResult.summary;
    document.getElementById('analogyText').innerText = parsedResult.analogy;
    document.getElementById('vocabText').innerText = parsedResult.vocab;

    // บันทึกลง Supabase Database
    await supabase.from('summaries').insert([
      { summary_result: parsedResult }
    ]);

    resultCard.classList.remove('hidden');

  } catch (error) {
    console.error(error);
    alert("เกิดข้อผิดพลาดในการประมวลผล ลองใหม่อีกครั้งครับ");
  } finally {
    submitBtn.disabled = false;
    submitBtn.classList.remove('opacity-50', 'cursor-not-allowed');
    loadingState.classList.add('hidden');
  }
}
