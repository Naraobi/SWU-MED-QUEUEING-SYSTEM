import { httpsCallable } from 'firebase/functions';
import { functions } from '../../firebase';

const updateUserAccount = httpsCallable(
  functions,
  'updateUserAccount'
);

export default updateUserAccount;