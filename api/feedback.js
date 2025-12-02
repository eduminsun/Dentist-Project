import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GENAI_API_KEY);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { conversationHistory, caseId } = req.body;

    if (!conversationHistory || conversationHistory.length === 0) {
      return res.status(400).json({ error: "No conversation history" });
    }

    // 대화 내용을 정리 (사용자의 발언만 평가)
    let conversationText = "";
    conversationHistory.forEach((msg, idx) => {
      if (msg.role === "user") {
        conversationText += `[${idx}] 의사: ${msg.text}\n`;
      }
    });

    // Gemini에 피드백 요청 (5단계 루브릭 기반)
    const prompt = `치과 진료 5단계 체크리스트로 평가하세요:
1. 인사 및 환자 확인 (환자 이름 확인, 편한 인사)
2. 방문 이유 확인 (주요 증상/불편 확인)
3. 정보 수집 및 공감 (추가 질문, 환자 말 경청)
4. 치료 계획 설명 (명확한 설명, 옵션 제시)
5. 진료 마무리 (다음 단계 안내, 안심 제공)

의사 발언:
${conversationText}

잘 이루어진 단계와 개선 필요 단계를 JSON으로 응답:
{"feedbacks": [{"stage": "5단계 이름", "done": true/false, "text": "한 줄 피드백"}]}`;

    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    
    const response = await model.generateContent({
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }]
        }
      ],
      generationConfig: {
        temperature: 0.6,
        maxOutputTokens: 180,
      }
    });

    const responseText = response.candidates[0].content.parts[0].text;

    // JSON 파싱
    let feedbackData;
    try {
      feedbackData = JSON.parse(responseText);
    } catch (e) {
      // JSON 블록만 추출 시도
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        feedbackData = JSON.parse(jsonMatch[0]);
      } else {
        console.error("Failed to parse feedback response:", responseText);
        return res.status(200).json({ feedbacks: [] });
      }
    }

    return res.status(200).json(feedbackData);
  } catch (error) {
    console.error("Feedback error:", error);
    return res.status(200).json({ feedbacks: [] });
  }
}
