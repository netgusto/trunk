# trunk
Dependency solver / container.

## How ?

```js

import { Trunk } from 'trunk';
import { Mailer, MockupMailer } from '...somepackage';

const trunk = new Trunk();

trunk
    .add('isprod', ['env'], (env) => env.ENVIRONMENT === 'prod')
    .add('env', () => process.env)
    .add('smtpcreds', ['env'], (env) => {
        return {
            host: env.SMTP_HOST,
            port: env.SMTP_PORT,
            user: env.SMTP_LOGIN,
            password: env.SMTP_PASSWORD
        };
    })
    .add('mailer', ['smtpcreds', 'isprod'], (smtpcreds, isprod) => {
        // promise will be resolved on open
        if(isprod) {
            return new Promise((resolve, reject) => {
                mailerlib(function(initializedmailer) {
                    resolve(initializedmailer);
                });
            });
        } else {
            return Promise.resolve(new MockupMailer());
        }
    });

trunk.open().then(() => {
    const mailer = trunk.get('mailer');
    mailer.send('example@example.com', 'Hello, World !', 'This is trunk !');
});
```

