// Lectura de consola simple (síncrona) para scripts de Node.
import { createInterface } from 'node:readline';
import { stdin as input, stdout as output } from 'node:process';

export function readlineSync(prompt, ocultar = false) {
  return new Promise((resolve) => {
    if (ocultar) {
      let res = '';
      const rl = createInterface({ input, output, terminal: true });
      output.write(prompt);
      input.setRawMode?.(true);
      input.resume();
      input.setEncoding('utf8');
      const onData = (chunk) => {
        for (const ch of chunk) {
          if (ch === '\u0003') process.exit(1);
          if (ch === '\r' || ch === '\n') {
            input.setRawMode?.(false);
            input.pause();
            rl.close();
            output.write('\n');
            resolve(res);
            return;
          }
          res += ch;
        }
      };
      input.on('data', onData);
    } else {
      const rl = createInterface({ input, output });
      rl.question(prompt, (ans) => {
        rl.close();
        resolve(ans);
      });
    }
  });
}