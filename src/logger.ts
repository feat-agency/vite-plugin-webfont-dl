import { env, stdout } from 'process';
import { Logger as ViteLogger } from 'vite';
import colors from 'picocolors';

export class Logger {
	private resolvedLogger?: ViteLogger;

	public setResolvedLogger(resolvedLogger: ViteLogger) {
		this.resolvedLogger = resolvedLogger;
	}

	public isTty() {
		return stdout.isTTY && !env.CI;
	}

	public info(output: string) {
		this.clearLine();
		this.resolvedLogger?.info(this.prefix() + output);
	}

	public error(output: string) {
		this.clearLine();
		this.resolvedLogger?.error(this.prefix() + output);
	}

	public clearLine() {
		if (this.isTty()) {
			stdout.clearLine(0);
			stdout.cursorTo(0);
		}
	}

	public flashLine(output: string) {
		if (this.isTty()) {
			this.clearLine();

			output = this.prefix() + output;

			if (output.length < stdout.columns) {
				stdout.write(output);
			} else {
				stdout.write(output.substring(0, stdout.columns - 1));
			}
		} else {
			this.info(output);
		}
	}

	private prefix() {
		return colors.dim('[webfont-dl] ');
	}
}

