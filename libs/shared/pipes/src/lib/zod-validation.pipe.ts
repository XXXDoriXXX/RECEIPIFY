import { ArgumentMetadata, BadRequestException, PipeTransform, Injectable } from "@nestjs/common";
import { ZodSchema } from "zod";

@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private schema: ZodSchema) {}

  transform(value: unknown, metadata: ArgumentMetadata) {
    const parseResult = this.schema.safeParse(value);

    if (!parseResult.success) {
      const formattedErrors = parseResult.error.issues.map(err => ({
        field: err.path.join('.') || 'query/body',
        issue: err.message,
      }));

      throw new BadRequestException({
        message: 'Validation failed',
        error: 'Bad Request',
        statusCode: 400,
        details: formattedErrors,
      });
    }

    return parseResult.data;
  }
}
