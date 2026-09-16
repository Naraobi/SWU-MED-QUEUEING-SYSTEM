import { httpsCallable } from 'firebase/functions';
import { functions } from '../../firebase';

const createUserAccount = httpsCallable(
  functions,
  'createUserAccount'
);

export default createUserAccount;