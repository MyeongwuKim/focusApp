import {
  RegisterPushDeviceTokenDocument,
  type RegisterPushDeviceTokenInput as GeneratedRegisterPushDeviceTokenInput,
} from "../graphql/generated";
import { requestGraphql } from "./graphqlClient";

export type RegisterPushDeviceTokenInput = Omit<GeneratedRegisterPushDeviceTokenInput, "platform"> & {
  platform: "ios" | "android" | "unknown";
};

export async function registerPushDeviceToken(input: RegisterPushDeviceTokenInput) {
  const data = await requestGraphql(RegisterPushDeviceTokenDocument, { input });
  return data.registerPushDeviceToken;
}
