import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
    SecurityAuditLogger,
    createAuditLogger,
    getAuditLogger,
    configureAuditLogger,
    SecurityAuditEvent,
} from '../../src/security/audit-logger';
import { Logger } from '../../src/types';

describe('SecurityAuditLogger', () => {
    let mockLogger: Logger;

    beforeEach(() => {
        mockLogger = {
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
            debug: vi.fn(),
            verbose: vi.fn(),
            silly: vi.fn(),
        };
    });

    describe('constructor and configuration', () => {
        it('should create logger with default config', () => {
            const logger = new SecurityAuditLogger();
            expect(logger).toBeInstanceOf(SecurityAuditLogger);
        });

        it('should create logger with custom config', () => {
            const logger = new SecurityAuditLogger(mockLogger, {
                enabled: false,
                minSeverity: 'error',
                includeSensitiveDetails: true,
            });
            expect(logger).toBeInstanceOf(SecurityAuditLogger);
        });

        it('should respect enabled=false config', () => {
            const logger = new SecurityAuditLogger(mockLogger, { enabled: false });
            logger.validationStarted('test', 5);
            expect(mockLogger.info).not.toHaveBeenCalled();
            expect(logger.getBufferedEvents()).toHaveLength(0);
        });
    });

    describe('correlation ID', () => {
        it('should set correlation ID', () => {
            const logger = new SecurityAuditLogger(mockLogger);
            logger.setCorrelationId('test-123');
            logger.validationStarted('test', 1);
            
            const events = logger.getBufferedEvents();
            expect(events[0].correlationId).toBe('test-123');
        });

        it('should generate correlation ID', () => {
            const logger = new SecurityAuditLogger();
            const id = logger.generateCorrelationId();
            expect(id).toMatch(/^sec-\d+-[a-z0-9]+$/);
        });

        it('should use custom correlation ID generator', () => {
            const logger = new SecurityAuditLogger(mockLogger, {
                correlationIdGenerator: () => 'custom-id-123',
            });
            const id = logger.generateCorrelationId();
            expect(id).toBe('custom-id-123');
        });
    });

    describe('validationStarted', () => {
        it('should log validation started event', () => {
            const logger = new SecurityAuditLogger(mockLogger);
            logger.validationStarted('cli', 10);
            
            expect(mockLogger.info).toHaveBeenCalled();
            const events = logger.getBufferedEvents();
            expect(events).toHaveLength(1);
            expect(events[0].type).toBe('VALIDATION_STARTED');
            expect(events[0].source).toBe('cli');
            expect(events[0].details.fieldCount).toBe(10);
        });
    });

    describe('validationPassed', () => {
        it('should log validation passed with no warnings', () => {
            const logger = new SecurityAuditLogger(mockLogger);
            logger.validationPassed('config');
            
            expect(mockLogger.info).toHaveBeenCalled();
            const events = logger.getBufferedEvents();
            expect(events[0].type).toBe('VALIDATION_PASSED');
            expect(events[0].severity).toBe('info');
        });

        it('should log validation passed with warnings', () => {
            const logger = new SecurityAuditLogger(mockLogger);
            logger.validationPassed('config', 3);
            
            expect(mockLogger.warn).toHaveBeenCalled();
            const events = logger.getBufferedEvents();
            expect(events[0].severity).toBe('warning');
            expect(events[0].details.warningCount).toBe(3);
        });
    });

    describe('validationFailed', () => {
        it('should log validation failed event', () => {
            const logger = new SecurityAuditLogger(mockLogger);
            const errors = [
                { field: 'path', code: 'PATH_TRAVERSAL' as const, message: 'Traversal detected', value: '../etc', source: 'cli' as const },
            ];
            logger.validationFailed('cli', errors);
            
            expect(mockLogger.error).toHaveBeenCalled();
            const events = logger.getBufferedEvents();
            expect(events[0].type).toBe('VALIDATION_FAILED');
            expect(events[0].severity).toBe('error');
            expect(events[0].details.errorCount).toBe(1);
        });
    });

    describe('pathBlocked', () => {
        it('should log path blocked event', () => {
            const logger = new SecurityAuditLogger(mockLogger);
            logger.pathBlocked('/etc/passwd', 'traversal attempt', 'cli', 'PATH_TRAVERSAL');
            
            expect(mockLogger.warn).toHaveBeenCalled();
            const events = logger.getBufferedEvents();
            expect(events[0].type).toBe('PATH_BLOCKED');
            expect(events[0].errorCode).toBe('PATH_TRAVERSAL');
        });

        it('should sanitize home directory in paths', () => {
            const logger = new SecurityAuditLogger(mockLogger, { includeSensitiveDetails: false });
            const home = process.env.HOME || process.env.USERPROFILE || '/home/user';
            logger.pathBlocked(`${home}/secret/file.txt`, 'blocked', 'cli');
            
            const events = logger.getBufferedEvents();
            expect(events[0].details.path).toContain('~');
        });

        it('should truncate long paths', () => {
            const logger = new SecurityAuditLogger(mockLogger, { includeSensitiveDetails: false });
            const longPath = '/a'.repeat(200);
            logger.pathBlocked(longPath, 'blocked', 'cli');
            
            const events = logger.getBufferedEvents();
            expect((events[0].details.path as string).length).toBeLessThanOrEqual(100);
        });

        it('should include full path when includeSensitiveDetails is true', () => {
            const logger = new SecurityAuditLogger(mockLogger, { includeSensitiveDetails: true });
            const home = process.env.HOME || process.env.USERPROFILE || '/home/user';
            logger.pathBlocked(`${home}/secret/file.txt`, 'blocked', 'cli');
            
            const events = logger.getBufferedEvents();
            expect(events[0].details.path).toContain(home);
        });
    });

    describe('numericRejected', () => {
        it('should log numeric rejected event', () => {
            const logger = new SecurityAuditLogger(mockLogger);
            logger.numericRejected('timeout', 99999999, 'exceeds maximum', 'cli');
            
            expect(mockLogger.warn).toHaveBeenCalled();
            const events = logger.getBufferedEvents();
            expect(events[0].type).toBe('NUMERIC_REJECTED');
            // Value should not be logged for security
            expect(events[0].details).not.toHaveProperty('value');
        });
    });

    describe('stringRejected', () => {
        it('should log string rejected event', () => {
            const logger = new SecurityAuditLogger(mockLogger);
            logger.stringRejected('model', 'contains null bytes', 'cli', 'STRING_NULL_BYTE');
            
            expect(mockLogger.warn).toHaveBeenCalled();
            const events = logger.getBufferedEvents();
            expect(events[0].type).toBe('STRING_REJECTED');
            expect(events[0].errorCode).toBe('STRING_NULL_BYTE');
        });
    });

    describe('profileChanged', () => {
        it('should log profile change event', () => {
            const logger = new SecurityAuditLogger(mockLogger);
            logger.profileChanged('development', 'production');
            
            expect(mockLogger.info).toHaveBeenCalled();
            const events = logger.getBufferedEvents();
            expect(events[0].type).toBe('PROFILE_CHANGED');
            expect(events[0].details.oldProfile).toBe('development');
            expect(events[0].details.newProfile).toBe('production');
        });
    });

    describe('configLoaded', () => {
        it('should log config loaded event', () => {
            const logger = new SecurityAuditLogger(mockLogger);
            logger.configLoaded('/path/to/config.yaml', 15);
            
            expect(mockLogger.info).toHaveBeenCalled();
            const events = logger.getBufferedEvents();
            expect(events[0].type).toBe('CONFIG_LOADED');
            expect(events[0].details.fieldCount).toBe(15);
        });
    });

    describe('suspiciousPattern', () => {
        it('should log suspicious pattern event', () => {
            const logger = new SecurityAuditLogger(mockLogger);
            logger.suspiciousPattern('query', 'SQL injection', 'config');
            
            expect(mockLogger.warn).toHaveBeenCalled();
            const events = logger.getBufferedEvents();
            expect(events[0].type).toBe('SUSPICIOUS_PATTERN');
        });
    });

    describe('severity filtering', () => {
        it('should filter events below minimum severity', () => {
            const logger = new SecurityAuditLogger(mockLogger, { minSeverity: 'error' });
            logger.validationStarted('test', 1); // info
            logger.validationPassed('test', 1); // warning
            
            expect(logger.getBufferedEvents()).toHaveLength(0);
            expect(mockLogger.info).not.toHaveBeenCalled();
            expect(mockLogger.warn).not.toHaveBeenCalled();
        });

        it('should log events at or above minimum severity', () => {
            const logger = new SecurityAuditLogger(mockLogger, { minSeverity: 'warning' });
            logger.validationStarted('test', 1); // info - filtered
            logger.validationPassed('test', 1); // warning - logged
            
            expect(logger.getBufferedEvents()).toHaveLength(1);
        });

        it('should log critical events', () => {
            const logger = new SecurityAuditLogger(mockLogger, { minSeverity: 'critical' });
            // No critical events in current API, but error should still be filtered
            logger.validationFailed('test', [{ field: 'x', code: 'PATH_TRAVERSAL', message: 'test', value: 'x', source: 'cli' as const }]);
            expect(logger.getBufferedEvents()).toHaveLength(0);
        });
    });

    describe('event buffer', () => {
        it('should buffer events', () => {
            const logger = new SecurityAuditLogger();
            logger.validationStarted('test', 1);
            logger.validationPassed('test');
            
            expect(logger.getBufferedEvents()).toHaveLength(2);
        });

        it('should clear buffer', () => {
            const logger = new SecurityAuditLogger();
            logger.validationStarted('test', 1);
            logger.clearBuffer();
            
            expect(logger.getBufferedEvents()).toHaveLength(0);
        });

        it('should limit buffer size', () => {
            const logger = new SecurityAuditLogger();
            // Log more than 100 events
            for (let i = 0; i < 110; i++) {
                logger.validationStarted('test', i);
            }
            
            expect(logger.getBufferedEvents()).toHaveLength(100);
        });

        it('should return copy of buffer', () => {
            const logger = new SecurityAuditLogger();
            logger.validationStarted('test', 1);
            const events = logger.getBufferedEvents();
            events.push({} as SecurityAuditEvent);
            
            expect(logger.getBufferedEvents()).toHaveLength(1);
        });
    });

    describe('log message formatting', () => {
        it('should format message with correlation ID', () => {
            const logger = new SecurityAuditLogger(mockLogger);
            logger.setCorrelationId('req-123');
            logger.validationStarted('test', 1);
            
            expect(mockLogger.info).toHaveBeenCalledWith(
                expect.stringContaining('[req-123]')
            );
        });

        it('should format message with event type', () => {
            const logger = new SecurityAuditLogger(mockLogger);
            logger.validationStarted('test', 1);
            
            expect(mockLogger.info).toHaveBeenCalledWith(
                expect.stringContaining('[SECURITY:VALIDATION_STARTED]')
            );
        });

        it('should include details in log message', () => {
            const logger = new SecurityAuditLogger(mockLogger);
            logger.validationStarted('test', 5);
            
            expect(mockLogger.info).toHaveBeenCalledWith(
                expect.stringContaining('"fieldCount":5')
            );
        });
    });

    describe('factory functions', () => {
        it('should create audit logger with createAuditLogger', () => {
            const logger = createAuditLogger(mockLogger, { minSeverity: 'warning' });
            expect(logger).toBeInstanceOf(SecurityAuditLogger);
        });

        it('should get global audit logger', () => {
            const logger1 = getAuditLogger();
            const logger2 = getAuditLogger();
            expect(logger1).toBe(logger2);
        });

        it('should configure global audit logger', () => {
            configureAuditLogger(mockLogger, { minSeverity: 'error' });
            const logger = getAuditLogger();
            logger.validationStarted('test', 1);
            // Should be filtered due to minSeverity: error
            expect(mockLogger.info).not.toHaveBeenCalled();
        });
    });
});

