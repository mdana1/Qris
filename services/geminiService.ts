
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { GoogleGenAI, Type } from "@google/genai";
import { cleanBase64 } from "../utils";

const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

export const analyzeQrisImage = async (base64Image: string): Promise<{ payload: string; merchantName?: string; nmid?: string }> => {
  const ai = getAI();
  const cleanImage = cleanBase64(base64Image);

  try {
    // Call generateContent with corrected structure and recommended responseSchema
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          {
            inlineData: {
              data: cleanImage,
              mimeType: 'image/png'
            }
          },
          {
            text: `You are an Indonesian fintech expert. Extract the raw QRIS payload (a string starting with 000201) from this image. 
            Also identify the Merchant Name (often found in tag 59) and NMID (National Merchant ID, often found in tag 02-51 or printed on the sheet).`
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            payload: {
              type: Type.STRING,
              description: 'The raw QRIS payload starting with 000201',
            },
            merchantName: {
              type: Type.STRING,
              description: 'The name of the merchant extracted from the QRIS data.',
            },
            nmid: {
              type: Type.STRING,
              description: 'The National Merchant ID (NMID) extracted from the QRIS data.',
            },
          },
          required: ["payload"],
        }
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
