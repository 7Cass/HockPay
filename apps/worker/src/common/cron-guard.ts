type CronGuardLogger = {
  warn(message: string): void;
};

const runningJobs = new Set<string>();

export async function runExclusiveCronJob(
  jobName: string,
  logger: CronGuardLogger,
  task: () => Promise<void>,
): Promise<void> {
  if (runningJobs.has(jobName)) {
    logger.warn(`Skipping ${jobName}; previous run still active`);
    return;
  }

  runningJobs.add(jobName);
  try {
    await task();
  } finally {
    runningJobs.delete(jobName);
  }
}
