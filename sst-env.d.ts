/* tslint:disable */
/* eslint-disable */
import "sst"
declare module "sst" {
  export interface Resource {
    "api": {
      "name": string
      "type": "sst.aws.Function"
      "url": string
    }
    "frontend": {
      "type": "sst.aws.Nextjs"
      "url": string
    }
    "stateMachineLambda-express": {
      "name": string
      "type": "sst.aws.Function"
    }
    "stateMachineLambda-standard": {
      "name": string
      "type": "sst.aws.Function"
    }
  }
}
export {}
