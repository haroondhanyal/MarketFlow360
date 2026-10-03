import { BadRequestException, Body, Controller, Delete, Get, NotFoundException, Param, Post, Put, Query, Req, Res, UseGuards } from "@nestjs/common";
import { ArrayMaxSize, ArrayMinSize, IsArray, IsBase64, IsIn, IsInt, IsString, Matches, MaxLength, Min, MinLength, ValidateNested } from "class-validator";
import { Type } from "class-transformer";
import { LeadStatus } from "@prisma/client";
import type { Response } from "express";
import { AuthGuard, SignedRequest, WorkspaceGuard } from "../auth";
import { scoped } from "../crm-common";
import { PrismaService } from "../prisma.service";

class PipelineStageDto {
  @IsString() @Matches(/^[A-Z][A-Z0-9_]{1,39}$/) key!: string;
  @IsString() @MinLength(2) @MaxLength(40) label!: string;
  @IsInt() @Min(0) position!: number;
}
class UpdatePipelineDto { @IsArray() @ArrayMinSize(1) @ArrayMaxSize(20) @ValidateNested({ each: true }) @Type(() => PipelineStageDto) stages!: PipelineStageDto[]; }
class AttachmentDto {
  @IsIn(["LEAD", "CUSTOMER", "TASK"]) recordType!: "LEAD" | "CUSTOMER" | "TASK";
  @IsString() recordId!: string;
  @IsString() @MinLength(1) @MaxLength(180) fileName!: string;
  @IsIn(["application/pdf", "image/png", "image/jpeg", "image/webp", "text/plain", "text/csv"]) mimeType!: string;
  @IsBase64() @MaxLength(4_200_000) data!: string;
}

const defaultStages = Object.values(LeadStatus).map((key, position) => ({ key, label: key.replaceAll("_", " ").replace(/\b\w/g, char => char.toUpperCase()), position }));

@Controller("pipeline") @UseGuards(AuthGuard, WorkspaceGuard)
export class PipelineController {
  constructor(private db: PrismaService) {}
  @Get("stages") async list(@Req() req: SignedRequest) {
    const stages = await this.db.pipelineStage.findMany({ where: scoped(req), orderBy: { position: "asc" } });
    return stages.length ? stages : defaultStages;
  }
  @Put("stages") async save(@Body() dto: UpdatePipelineDto, @Req() req: SignedRequest) {
    const keys = dto.stages.map(stage => stage.key);
    if (new Set(keys).size !== keys.length) throw new BadRequestException("Stage keys must be unique.");
    if (!keys.includes("NEW")) throw new BadRequestException("Keep the NEW stage because new leads start there.");
    if (dto.stages.some(stage => stage.label.trim().length < 2)) throw new BadRequestException("Stage labels need at least two non-space characters.");
    const positions = dto.stages.map(stage => stage.position);
    if (new Set(positions).size !== dto.stages.length || positions.some(position => position >= dto.stages.length) || !positions.includes(0)) throw new BadRequestException("Use each pipeline position from zero through the number of stages minus one once.");
    const previous = await this.db.pipelineStage.findMany({ where: scoped(req), select: { key: true } });
    const oldKeys = previous.length ? previous.map(stage => stage.key) : defaultStages.map(stage => stage.key);
    const removedKeys = oldKeys.filter(key => !keys.includes(key));
    const fallback = keys[0];
    await this.db.$transaction(async tx => {
      for (const key of removedKeys) await tx.lead.updateMany({ where: { ...scoped(req), status: key }, data: { status: fallback } });
      for (const stage of dto.stages) await tx.pipelineStage.upsert({ where: { workspaceId_key: { workspaceId: req.workspaceId!, key: stage.key } }, update: { label: stage.label.trim(), position: stage.position }, create: { ...stage, label: stage.label.trim(), ...scoped(req) } });
      await tx.pipelineStage.deleteMany({ where: { ...scoped(req), key: { notIn: keys } } });
    });
    return this.db.pipelineStage.findMany({ where: scoped(req), orderBy: { position: "asc" } });
  }
}

@Controller("attachments") @UseGuards(AuthGuard, WorkspaceGuard)
export class AttachmentsController {
  constructor(private db: PrismaService) {}
  @Get() async list(@Query("recordType") recordType: string, @Query("recordId") recordId: string, @Req() req: SignedRequest) {
    await this.requireRecord(recordType, recordId, req);
    return this.db.attachment.findMany({ where: { ...scoped(req), recordType, recordId }, select: { id: true, fileName: true, mimeType: true, sizeBytes: true, createdAt: true }, orderBy: { createdAt: "desc" } });
  }
  @Post() async create(@Body() dto: AttachmentDto, @Req() req: SignedRequest) {
    await this.requireRecord(dto.recordType, dto.recordId, req);
    const bytes = Buffer.from(dto.data, "base64");
    if (!bytes.length || bytes.length > 3 * 1024 * 1024) throw new BadRequestException("Attachments must be between 1 byte and 3 MB.");
    if (!matchesMime(bytes, dto.mimeType)) throw new BadRequestException("The file contents do not match the selected file type.");
    const fileName = dto.fileName.replace(/[\\/\r\n\0]/g, "_").trim();
    if (!fileName) throw new BadRequestException("Enter a valid file name.");
    return this.db.attachment.create({ data: { ...scoped(req), recordType: dto.recordType, recordId: dto.recordId, fileName, mimeType: dto.mimeType, sizeBytes: bytes.length, content: bytes }, select: { id: true, fileName: true, mimeType: true, sizeBytes: true, createdAt: true } });
  }
  @Get(":id/download") async download(@Param("id") id: string, @Req() req: SignedRequest, @Res() res: Response) {
    const file = await this.db.attachment.findFirst({ where: { id, ...scoped(req) } });
    if (!file) throw new NotFoundException("Attachment not found.");
    const fallbackName = file.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    res.setHeader("Content-Type", "application/octet-stream"); res.setHeader("X-Content-Type-Options", "nosniff"); res.setHeader("Content-Disposition", `attachment; filename="${fallbackName}"; filename*=UTF-8''${encodeURIComponent(file.fileName)}`); res.send(Buffer.from(file.content));
  }
  @Delete(":id") async remove(@Param("id") id: string, @Req() req: SignedRequest) { const file = await this.db.attachment.findFirst({ where: { id, ...scoped(req) } }); if (!file) throw new NotFoundException("Attachment not found."); await this.db.attachment.delete({ where: { id } }); return { ok: true }; }
  private async requireRecord(type: string, id: string, req: SignedRequest) {
    const where = { id, ...scoped(req) };
    const found = type === "LEAD" ? await this.db.lead.findFirst({ where }) : type === "CUSTOMER" ? await this.db.customer.findFirst({ where }) : type === "TASK" ? await this.db.task.findFirst({ where }) : null;
    if (!found) throw new NotFoundException("Record not found in this workspace.");
  }
}

function matchesMime(bytes: Buffer, mimeType: string) {
  if (mimeType === "application/pdf") return bytes.subarray(0, 5).toString("ascii") === "%PDF-";
  if (mimeType === "image/png") return bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (mimeType === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mimeType === "image/webp") return bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP";
  return !bytes.includes(0) && !bytes.toString("utf8").includes("\uFFFD");
}
