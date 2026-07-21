import {
  BadGatewayException,
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Prisma, TeamRole } from "@prisma/client";
import PDFDocument from "pdfkit";
import nodemailer from "nodemailer";
import { PrismaService } from "../prisma/prisma.service";
import { EmailTaskReportDto, TaskReportQueryDto } from "./dto/report.dto";

const TERMINAL_STATUSES = new Set(["COMPLETED", "CANCELLED"]);

const REPORT_TASK_INCLUDE = {
  assignee: { select: { fullName: true, email: true } },
  team: { select: { id: true, name: true } },
} satisfies Prisma.TaskInclude;

type ReportTask = Prisma.TaskGetPayload<{ include: typeof REPORT_TASK_INCLUDE }> & {
  derivedStatus: string;
};

type ReportData = {
  title: string;
  subtitle: string;
  period: string;
  tasks: ReportTask[];
};

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async createTaskReport(userId: string, query: TaskReportQueryDto) {
    const report = await this.loadReport(userId, query);
    return {
      buffer: await this.renderPdf(report),
      filename: this.reportFilename(report.title),
      report,
    };
  }

  async emailTaskReport(userId: string, dto: EmailTaskReportDto) {
    const membership = await this.prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId: dto.teamId, userId } },
      include: {
        team: {
          include: {
            members: {
              include: {
                user: { select: { fullName: true, email: true } },
              },
            },
          },
        },
      },
    });

    if (!membership) throw new NotFoundException("Equipe não encontrada");
    if (membership.role !== TeamRole.OWNER) {
      throw new ForbiddenException(
        "Somente o proprietário pode enviar o relatório para a equipe",
      );
    }

    const reportResult = await this.createTaskReport(userId, {
      teamId: dto.teamId,
      from: dto.from,
      to: dto.to,
    });
    const recipients = [
      ...new Set(
        membership.team.members.map((member) =>
          member.user.email.trim().toLowerCase(),
        ),
      ),
    ];
    const maxRecipients = Number(
      this.config.get<string>("REPORT_MAX_RECIPIENTS") ?? 50,
    );
    if (recipients.length > maxRecipients) {
      throw new BadRequestException(
        `A equipe excede o limite de ${maxRecipients} destinatários`,
      );
    }

    const host = this.config.get<string>("SMTP_HOST");
    const from = this.config.get<string>("SMTP_FROM");
    if (!host || !from) {
      throw new ServiceUnavailableException(
        "Envio de e-mail não configurado. Informe SMTP_HOST e SMTP_FROM.",
      );
    }

    const port = Number(this.config.get<string>("SMTP_PORT") ?? 587);
    const secure =
      this.config.get<string>("SMTP_SECURE") === "true" || port === 465;
    const user = this.config.get<string>("SMTP_USER");
    const pass = this.config.get<string>("SMTP_PASS");
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: user && pass ? { user, pass } : undefined,
    });

    const summary = this.summarize(reportResult.report.tasks);
    try {
      await transporter.sendMail({
        from,
        to: from,
        bcc: recipients,
        subject:
          dto.subject?.trim() ||
          `CodeForge Systems | Relatório de demandas — ${membership.team.name}`,
        html: this.emailTemplate({
          teamName: membership.team.name,
          period: reportResult.report.period,
          summary,
        }),
        attachments: [
          {
            filename: reportResult.filename,
            content: reportResult.buffer,
            contentType: "application/pdf",
          },
        ],
      });
    } catch {
      throw new BadGatewayException(
        "O servidor de e-mail recusou ou não concluiu o envio",
      );
    }

    return {
      ok: true,
      team: membership.team.name,
      recipients: recipients.length,
    };
  }

  private async loadReport(userId: string, query: TaskReportQueryDto) {
    const { from, to } = this.resolvePeriod(query.from, query.to);
    let title = "Minhas demandas";
    let subtitle = "Visão individual de atividades e prioridades";
    let where: Prisma.TaskWhereInput = {
      assigneeId: userId,
      startAt: { gte: from, lte: to },
    };

    if (query.teamId) {
      const team = await this.prisma.team.findFirst({
        where: {
          id: query.teamId,
          members: { some: { userId } },
        },
        select: { id: true, name: true },
      });
      if (!team) throw new NotFoundException("Equipe não encontrada");
      title = team.name;
      subtitle = "Relatório executivo de demandas da equipe";
      where = {
        teamId: team.id,
        visibility: "TEAM",
        startAt: { gte: from, lte: to },
      };
    }

    const tasks = await this.prisma.task.findMany({
      where,
      include: REPORT_TASK_INCLUDE,
      orderBy: [{ startAt: "asc" }, { priority: "desc" }],
    });
    const maxTasks = Number(this.config.get<string>("REPORT_MAX_TASKS") ?? 1000);
    if (tasks.length > maxTasks) {
      throw new BadRequestException(
        `O relatório excede o limite de ${maxTasks} demandas`,
      );
    }

    const withStatus = tasks
      .map((task) => ({
        ...task,
        derivedStatus:
          !TERMINAL_STATUSES.has(task.status) && task.endAt < new Date()
            ? "OVERDUE"
            : task.status,
      }))
      .sort((a, b) => this.urgencyScore(b) - this.urgencyScore(a));

    return {
      title,
      subtitle,
      period: `${this.formatDate(from)} a ${this.formatDate(to)}`,
      tasks: withStatus,
    };
  }

  private async renderPdf(report: ReportData) {
    const doc = new PDFDocument({
      size: "A4",
      margin: 42,
      bufferPages: true,
      info: {
        Title: `CodeForge Systems - ${report.title}`,
        Author: "CodeForge Systems",
        Subject: "Relatório de demandas",
      },
    });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    const completed = new Promise<Buffer>((resolve, reject) => {
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);
    });

    this.drawHeader(doc, report);
    this.drawSummary(doc, report.tasks);
    doc.moveDown(1.4);
    doc
      .font("Helvetica-Bold")
      .fontSize(13)
      .fillColor("#E2E8F0")
      .text("Demandas por ordem de urgência");
    doc.moveDown(0.65);

    if (report.tasks.length === 0) {
      doc
        .roundedRect(42, doc.y, 511, 68, 8)
        .fill("#111827");
      doc
        .font("Helvetica")
        .fontSize(10)
        .fillColor("#94A3B8")
        .text("Nenhuma demanda encontrada para o período selecionado.", 58, doc.y + 24);
    } else {
      report.tasks.forEach((task, index) => {
        if (doc.y > 700) {
          doc.addPage();
          this.drawContinuationHeader(doc, report.title);
        }
        this.drawTaskRow(doc, task, index + 1);
      });
    }

    const range = doc.bufferedPageRange();
    for (let page = range.start; page < range.start + range.count; page += 1) {
      doc.switchToPage(page);
      doc
        .font("Helvetica")
        .fontSize(8)
        .fillColor("#64748B")
        .text(
          `CodeForge Systems • Gerado em ${new Intl.DateTimeFormat("pt-BR", {
            dateStyle: "short",
            timeStyle: "short",
          }).format(new Date())}`,
          42,
          806,
          { width: 390, lineBreak: false },
        )
        .text(`Página ${page + 1} de ${range.count}`, 432, 806, {
          width: 121,
          align: "right",
          lineBreak: false,
        });
    }

    doc.end();
    return completed;
  }

  private drawHeader(doc: PDFKit.PDFDocument, report: ReportData) {
    doc.rect(0, 0, doc.page.width, 150).fill("#07111F");
    doc.roundedRect(42, 36, 34, 34, 8).fill("#14B8A6");
    doc
      .font("Helvetica-Bold")
      .fontSize(16)
      .fillColor("#07111F")
      .text("TF", 48, 45, { width: 22, align: "center" });
    doc
      .font("Helvetica-Bold")
      .fontSize(20)
      .fillColor("#F8FAFC")
      .text("CodeForge Systems", 86, 42);
    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor("#94A3B8")
      .text("RELATÓRIO DE DEMANDAS", 86, 64, { characterSpacing: 1.2 });
    doc
      .font("Helvetica-Bold")
      .fontSize(23)
      .fillColor("#F8FAFC")
      .text(report.title, 42, 91, { width: 350, ellipsis: true });
    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor("#94A3B8")
      .text(report.subtitle, 42, 121);
    doc
      .font("Helvetica-Bold")
      .fontSize(9)
      .fillColor("#5EEAD4")
      .text(report.period, 395, 103, { width: 158, align: "right" });
    doc.y = 172;
  }

  private drawContinuationHeader(doc: PDFKit.PDFDocument, title: string) {
    doc.rect(0, 0, doc.page.width, 64).fill("#07111F");
    doc
      .font("Helvetica-Bold")
      .fontSize(14)
      .fillColor("#F8FAFC")
      .text("CodeForge Systems", 42, 24);
    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor("#5EEAD4")
      .text(title, 300, 27, { width: 253, align: "right" });
    doc.y = 86;
  }

  private drawSummary(doc: PDFKit.PDFDocument, tasks: ReportTask[]) {
    const summary = this.summarize(tasks);
    const cards = [
      { label: "Total", value: summary.total, color: "#38BDF8" },
      { label: "Urgentes", value: summary.urgent, color: "#FB7185" },
      { label: "Atrasadas", value: summary.overdue, color: "#F97316" },
      { label: "Concluídas", value: summary.completed, color: "#2DD4BF" },
    ];
    cards.forEach((card, index) => {
      const x = 42 + index * 130;
      doc.roundedRect(x, 172, 121, 68, 8).fill("#111827");
      doc.rect(x, 172, 4, 68).fill(card.color);
      doc
        .font("Helvetica-Bold")
        .fontSize(20)
        .fillColor("#F8FAFC")
        .text(String(card.value), x + 16, 187, { width: 92 });
      doc
        .font("Helvetica")
        .fontSize(8)
        .fillColor("#94A3B8")
        .text(card.label.toUpperCase(), x + 16, 215, {
          width: 92,
          characterSpacing: 0.7,
        });
    });
    doc.y = 250;
  }

  private drawTaskRow(
    doc: PDFKit.PDFDocument,
    task: ReportTask,
    index: number,
  ) {
    const y = doc.y;
    const status = this.statusLabel(task.derivedStatus);
    const priority = this.priorityLabel(task.priority);
    const accent =
      task.derivedStatus === "OVERDUE"
        ? "#F97316"
        : task.priority === "HIGH"
          ? "#FB7185"
          : task.priority === "MEDIUM"
            ? "#FBBF24"
            : "#2DD4BF";

    doc.roundedRect(42, y, 511, 72, 7).fill("#111827");
    doc.rect(42, y, 4, 72).fill(accent);
    doc
      .font("Helvetica-Bold")
      .fontSize(8)
      .fillColor("#64748B")
      .text(String(index).padStart(2, "0"), 57, y + 13, { width: 20 });
    doc
      .font("Helvetica-Bold")
      .fontSize(10)
      .fillColor("#F8FAFC")
      .text(task.title, 84, y + 11, { width: 280, ellipsis: true });
    doc
      .font("Helvetica")
      .fontSize(8.5)
      .fillColor("#94A3B8")
      .text(
        `${task.assignee.fullName}  •  ${this.formatDateTime(task.startAt)}–${this.formatTime(task.endAt)}`,
        84,
        y + 31,
        { width: 320, ellipsis: true },
      );
    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor("#64748B")
      .text(task.category || task.team?.name || "Atividade", 84, y + 49, {
        width: 300,
        ellipsis: true,
      });
    doc
      .roundedRect(410, y + 11, 125, 20, 5)
      .fill(accent);
    doc
      .font("Helvetica-Bold")
      .fontSize(7.5)
      .fillColor("#07111F")
      .text(`${priority} • ${status}`, 416, y + 18, {
        width: 113,
        align: "center",
        ellipsis: true,
      });
    doc.y = y + 80;
  }

  private resolvePeriod(fromValue?: string, toValue?: string) {
    const now = new Date();
    const from = fromValue ? new Date(fromValue) : new Date(now);
    const to = toValue ? new Date(toValue) : new Date(now);
    if (!fromValue) from.setHours(0, 0, 0, 0);
    if (!toValue) to.setHours(23, 59, 59, 999);
    if (from > to) {
      throw new BadRequestException("A data inicial deve ser anterior à final");
    }
    const maxDays = Number(this.config.get<string>("REPORT_MAX_DAYS") ?? 366);
    const periodDays = (to.getTime() - from.getTime()) / 86_400_000;
    if (periodDays > maxDays) {
      throw new BadRequestException(
        `O período máximo permitido é de ${maxDays} dias`,
      );
    }
    return { from, to };
  }

  private summarize(tasks: ReportTask[]) {
    return {
      total: tasks.length,
      urgent: tasks.filter(
        (task) =>
          task.priority === "HIGH" && !TERMINAL_STATUSES.has(task.status),
      ).length,
      overdue: tasks.filter((task) => task.derivedStatus === "OVERDUE").length,
      completed: tasks.filter((task) => task.status === "COMPLETED").length,
    };
  }

  private urgencyScore(task: ReportTask) {
    if (task.derivedStatus === "OVERDUE") return 100;
    if (task.status === "COMPLETED" || task.status === "CANCELLED") return 0;
    if (task.priority === "HIGH") return 75;
    if (task.priority === "MEDIUM") return 45;
    return 20;
  }

  private emailTemplate(input: {
    teamName: string;
    period: string;
    summary: ReturnType<ReportsService["summarize"]>;
  }) {
    return `
      <div style="background:#07111f;padding:32px;font-family:Arial,sans-serif;color:#e2e8f0">
        <div style="max-width:640px;margin:auto;background:#111827;border:1px solid #243244;border-radius:16px;overflow:hidden">
          <div style="padding:28px;background:linear-gradient(135deg,#0f766e,#07111f)">
            <div style="font-size:12px;letter-spacing:2px;color:#99f6e4">TASKFLOW</div>
            <h1 style="margin:10px 0 4px;font-size:24px;color:#fff">Relatório de demandas</h1>
            <p style="margin:0;color:#ccfbf1">${this.escapeHtml(input.teamName)} • ${input.period}</p>
          </div>
          <div style="padding:28px">
            <p style="margin-top:0;color:#cbd5e1">Olá, equipe. O relatório atualizado está anexado em PDF.</p>
            <div style="display:flex;gap:10px;flex-wrap:wrap;margin:24px 0">
              ${this.emailMetric("Total", input.summary.total, "#38bdf8")}
              ${this.emailMetric("Urgentes", input.summary.urgent, "#fb7185")}
              ${this.emailMetric("Atrasadas", input.summary.overdue, "#f97316")}
              ${this.emailMetric("Concluídas", input.summary.completed, "#2dd4bf")}
            </div>
            <p style="margin-bottom:0;font-size:12px;color:#64748b">Mensagem enviada automaticamente pela CodeForge Systems.</p>
          </div>
        </div>
      </div>
    `;
  }

  private emailMetric(label: string, value: number, color: string) {
    return `<div style="min-width:108px;padding:14px;background:#0b1220;border-left:3px solid ${color};border-radius:8px"><strong style="display:block;font-size:22px;color:#fff">${value}</strong><span style="font-size:11px;color:#94a3b8">${label}</span></div>`;
  }

  private escapeHtml(value: string) {
    return value.replace(
      /[&<>"']/g,
      (char) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#039;",
        })[char]!,
    );
  }

  private reportFilename(title: string) {
    const slug = title
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase();
    return `taskflow-${slug || "demandas"}-${new Date()
      .toISOString()
      .slice(0, 10)}.pdf`;
  }

  private priorityLabel(priority: string) {
    return ({ LOW: "BAIXA", MEDIUM: "MÉDIA", HIGH: "ALTA" })[priority] ?? priority;
  }

  private statusLabel(status: string) {
    return (
      {
        NOT_STARTED: "NÃO INICIADA",
        IN_PROGRESS: "EM ANDAMENTO",
        PAUSED: "PAUSADA",
        WAITING_THIRD_PARTY: "AGUARDANDO",
        COMPLETED: "CONCLUÍDA",
        CANCELLED: "CANCELADA",
        OVERDUE: "ATRASADA",
      }[status] ?? status
    );
  }

  private formatDate(date: Date) {
    return new Intl.DateTimeFormat("pt-BR").format(date);
  }

  private formatDateTime(date: Date) {
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  }

  private formatTime(date: Date) {
    return new Intl.DateTimeFormat("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  }
}
