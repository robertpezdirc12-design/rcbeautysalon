-- P1 #76: dnevnik poganjanja ozadjih opravil (cron tick).
--
-- "Ali je opomnik odšel?" mora biti odgovorljivo brez branja Vercel
-- logov: vsak tek zapiše vrstico s števci. Tihi cron, ki ne dela nič,
-- je slabši kot nobenega — ta tabela je tisto, kar naredi napako
-- vidljivo (dashboard/SQL pregled, brez dodatnih orodij).
CREATE TABLE "JobRun" (
    "id" TEXT NOT NULL,
    "job" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "ok" BOOLEAN NOT NULL DEFAULT true,
    "sent" INTEGER NOT NULL DEFAULT 0,
    "failed" INTEGER NOT NULL DEFAULT 0,
    "detail" JSONB,

    CONSTRAINT "JobRun_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "JobRun_job_startedAt_idx" ON "JobRun"("job", "startedAt");
