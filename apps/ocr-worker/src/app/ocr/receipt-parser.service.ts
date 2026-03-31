import { Injectable , Logger} from '@nestjs/common';
import {OcrParsedResult} from "./interfaces/ocr-job.interface";

@Injectable()
export class ReceiptParserService {
  private readonly logger = new Logger(ReceiptParserService.name);

  parse(rawText: string):OcrParsedResult{
    this.logger.log('Executing heuristic parsing algorithm on raw OCR text');

    const lines = rawText
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);
    return {
      merchantName: this.extractMerchant(lines),
      totalAmount:this.extractTotal(lines),
      date:this.extractDate(rawText),
      rawText: rawText,
    }
  }
  private extractMerchant(lines: string[]):string{
    return lines.length>0?lines[0]:'Unknown Merchant';
  }
  private extractTotal(lines: string[]):number{
    let maxAmount = 0;
    //like 15.99  1,123.45  15,99
    const amountRegex = /\b\d{1,3}(?:[.,]\d{3})*[.,]\d{2}\b/g;

    for (const line of lines) {
      const matches = line.match(amountRegex);
      if(matches && matches.length>0){
        for(const match of matches){
          //convert 1,123.45 to 1123.45
          const cleanString = match
            .replace(/,/g, '.')
            .replace(/\.(?=.*\.)/g, '');
          const cleanNumber = parseFloat(cleanString);
          if(cleanNumber>maxAmount){
            maxAmount = cleanNumber;
          }
        }
      }
    }
  return maxAmount;
  }
  private extractDate(rawText: string):Date{
    const dateRegex = /\b(\d{2}|\d{4})[-/.](\d{2})[-/.](\d{2}|\d{4})\b/;
    const match = rawText.match(dateRegex);

    if(match){
      const parsedDate = new Date(match[0]);
      if(!isNaN(parsedDate.getTime())&& parsedDate.getFullYear()>2000){
        return parsedDate;
      }
    }
    return new Date();
  }

}
