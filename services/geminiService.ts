
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { GoogleGenAI } from "@google/genai";
import { cleanBase64 } from "../utils";

const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

export const analyzeQrisImage = async (base64Image: string): Promise<{ payload: string; merchantName?: string; nmid?: string }> => {
  const ai = getAI();
  const cleanImage = cleanBase64(base64Image);

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [
        {
          inlineData: {
            data: cleanImage,
            mimeType: 'image/png'
          }
        },
        {
          text: `You are an Indonesian fintech expert. Extract the raw QRIS payload (a string starting with 000201) from this image. 
          Also identify the Merchant Name (often found in tag 59) and NMID (National Merchant ID, often found in tag 02-51 or printed on the sheet).
          Return ONLY a JSON object with keys: "payload", "merchantName", "nmid". If you can't find them, leave them null.`
        }
      ],
      config: {
        responseMimeType: "application/json"
      }
    });

    const result = JSON.parse(response.text || "{}");
    return {
      payload: result.payload || "",
      merchantName: result.merchantName || "",
      nmid: result.nmid || ""
    };
  } catch (error) {
    console.error("Gemini QRIS analysis failed:", error);
    throw new Error("Could not process QRIS image. Please try another one.");
  }
};
