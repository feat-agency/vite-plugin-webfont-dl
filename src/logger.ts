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

	public info(output: string, withPrefix = true) {
		this.clearLine();
		this.resolvedLogger?.info((withPrefix ? this.prefix() : '') + output);
	}

	public error(output: string, withPrefix = true) {
		this.clearLine();
		this.resolvedLogger?.error((withPrefix ? this.prefix() : '') + output);
	}

	public clearLine() {
		if (this.isTty()) {
			stdout.clearLine(0);
			stdout.cursorTo(0);
		}
	}

	public flashLine(output: string, withPrefix = true) {
		if (this.isTty()) {
			this.clearLine();

			output = (withPrefix ? this.prefix() : '') + output;

			if (output.length < stdout.columns) {
				stdout.write(output);
			} else {
				stdout.write(output.substring(0, stdout.columns - 1));
			}
		} else {
			this.info(output, withPrefix);
		}
	}

	private prefix() {
		return colors.dim('[webfont-dl] ');
	}
}

