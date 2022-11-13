import { NextApiResponse } from 'next'
import { verifyToken } from '../../lib/jwt'
import { prisma } from '../../lib/db'
import { withMiddlewares } from '../../middlewares'
import {
  authMiddleware,
  NextApiRequestWithUser,
} from '../../middlewares/auth-middleware'
import { UserSession } from '../../lib/types/auth'
import { generateAccessToken } from '../../lib/auth'

type Data = {
  token: string
}

const refreshRoute = async (
  req: NextApiRequestWithUser,
  res: NextApiResponse<ApiResponse<Data>>
) => {
  // Read refresh token from request body
  const { refreshToken } = req.body as { refreshToken: string }

  // If refresh token is not present, return a 400 response
  if (!refreshToken) {
    return res.status(400).json({
      success: false,
      message: 'Missing refresh token',
    })
  }

  // Check if refresh token is valid
  if (
    await verifyToken(
      refreshToken,
      process.env.JWT_REFRESH_TOKEN_SECRET as string
    )
  ) {
    // Ok, decode JWT to get user infos
    const decoded = (await verifyToken(
      refreshToken,
      process.env.JWT_REFRESH_TOKEN_SECRET as string
    )) as UserSession

    // Now compare refresh token and access token to see if they match
    if (decoded.id === req.user.id && decoded.email === req.user.email) {
      // If they match, check if refresh token exists in database + is assigned to specified user
      const user = await prisma.user.findFirst({
        where: {
          id: req.user.id,
          email: req.user.email,
          refreshToken: refreshToken,
        },
      })

      // If user does not exist, return a 401 response
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Invalid refresh token',
        })
      } else {
        // If user exists, generate new access token
        const token = generateAccessToken(user)

        // return new access token
        return res.status(200).json({
          success: true,
          data: {
            token,
          },
        })
      }
    } else {
      // If they don't match, return a 401 response
      return res.status(401).json({
        success: false,
        message: 'Invalid refresh token',
      })
    }
  } else {
    // Refresh token is not valid, return a 401 response
    return res.status(401).json({
      success: false,
      message: 'Invalid refresh token',
    })
  }
}

export default withMiddlewares(authMiddleware, refreshRoute)
