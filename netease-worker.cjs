// Keep dependency diagnostics (which may include upstream cookies) off stdout/stderr.
const api = require('@neteasecloudmusicapienhanced/api');
process.on('message', async ({id, method, params}) => {
  try {
    const result = await api[method]({...params, timeout:15000, unblock:'false', randomCNIP:false});
    process.send({id, result});
  } catch (error) {
    process.send({id, error:{code:error?.body?.code||502, message:'网易云暂时未返回结果，请稍后重试。'}});
  }
});

process.on('disconnect',()=>process.exit(0));
