import * as winston from 'winston';
import { utilities as nestWinstonModuleUtilities } from 'nest-winston';

export const winstonConfig = {
  transports: [
    new winston.transports.Console({
      level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.ms(),
        process.env.NODE_ENV === 'production'
          ? winston.format.json()
          : nestWinstonModuleUtilities.format.nestLike('EventPlatform', {
              colors: true,
              prettyPrint: true,
            }),
      ),
    }),
  ],
};

export const winstonLogger = winston.createLogger(winstonConfig);
